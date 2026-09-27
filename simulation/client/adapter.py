# Python 2.7/3 compatible. No imports of, or changes to, live ClientDogmaLocation.
import math
import types
import weakref

try:
    INTEGER_TYPES = (int, long)
    STRING_TYPES = (basestring,)
except NameError:
    INTEGER_TYPES = (int,)
    STRING_TYPES = (str,)

BANDWIDTH = 1271
BAY = 283
MAX_ACTIVE = 352


def _positive(value):
    return not isinstance(value, bool) and isinstance(value, INTEGER_TYPES + (float,)) and value > 0 and not math.isinf(value) and not math.isnan(value)


def validate_policy(policy):
    """Reject the entire provider on any malformed data; never invent rules."""
    if not isinstance(policy, dict) or policy.get('schema') != 1 or policy.get('evejs') != '0.12.9' or policy.get('clientBuild') != 3396210:
        return None
    revision = policy.get('revision')
    if not isinstance(revision, STRING_TYPES) or len(revision) != 64 or any(c not in '0123456789abcdef' for c in revision):
        return None
    providers = policy.get('providers')
    if not isinstance(providers, dict) or set(providers) != set(['droneclassbalance']):
        return None
    provider = providers.get('droneclassbalance')
    if not isinstance(provider, dict) or provider.get('schema') != 1:
        return None
    rules, hulls = provider.get('rules'), provider.get('hulls')
    if not isinstance(rules, list) or not isinstance(hulls, dict) or len(rules) > 10000 or len(hulls) > 20000:
        return None
    for rule in rules:
        if not isinstance(rule, list) or len(rule) != 3 or not _positive(rule[0]) or not _positive(rule[1]):
            return None
        limit = rule[2]
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, INTEGER_TYPES) or limit <= 0 or limit > 9007199254740991):
            return None
    resolved = {}
    for key, index in hulls.items():
        if not isinstance(key, STRING_TYPES) or not key.isdigit() or int(key) <= 0 or str(int(key)) != key:
            return None
        if isinstance(index, bool) or not isinstance(index, INTEGER_TYPES) or index < 0 or index >= len(rules):
            return None
        resolved[int(key)] = tuple(rules[index])
    return resolved


def _bind(function, obj):
    try:
        return types.MethodType(function, obj)
    except TypeError:
        return types.MethodType(function, obj, obj.__class__)


class PrivateGhostRuntime(object):
    """One private wrapper owner for our mod family; DCB is the only current feature."""
    def __init__(self, policy, fitting_class, native_tracker_method, bandwidth_used_attribute,
                 session, usable, warning, picker_class=None):
        self.rules = validate_policy(policy)
        self.active = self.rules is not None
        self.fitting_class = fitting_class
        self.native_tracker_method = native_tracker_method
        self.bandwidth_used_attribute = bandwidth_used_attribute
        self.session = session
        self.usable = usable
        self.warning = warning
        self.records = []
        self.original_init = None
        self.init_wrapper = None
        self.picker_class = picker_class
        self.original_picker_max = None
        self.picker_wrapper = None

    def install(self, existing=None):
        if not self.active:
            return False
        owner = self
        # Read the stored function: Python 2 class access creates an unbound
        # method, whose identity differs on every access.
        self.original_init = self.fitting_class.__dict__['__init__']
        def initialize(location, *args, **kwargs):
            result = owner.original_init(location, *args, **kwargs)
            try:
                owner.attach(location)
            except Exception:
                # Instance attachment is transactional; native construction survives.
                pass
            return result
        self.init_wrapper = initialize
        self.fitting_class.__init__ = initialize
        if self.picker_class is not None:
            self.original_picker_max = self.picker_class.__dict__['GetMaxActiveDrones']
            def picker_max(menu):
                location = getattr(menu, 'fittingDogmaLocation', None)
                if owner.active and owner.usable() and any(ref() is location for ref, _ in owner.records):
                    return int(location.GetMaxActiveDrones())
                return owner.original_picker_max(menu)
            self.picker_wrapper = picker_max
            self.picker_class.GetMaxActiveDrones = picker_max
        if existing is not None:
            self.attach(existing)
        return True

    def _rule(self, location, raw_get):
        if not self.active or not self.usable() or not isinstance(location, self.fitting_class):
            return None
        ship_id = location.GetCurrentShipID()
        # Ghost keys are distinct from the real session ship, even for the same type.
        if ship_id is None or ship_id == getattr(self.session, 'shipid', None):
            return None
        ship = location.dogmaItems.get(ship_id)
        if ship is None or getattr(ship, 'categoryID', None) != 6:
            return None
        rule = self.rules.get(int(ship.typeID))
        if rule is None:
            return None
        # Always use unprojected effective values for eligibility. No compounding.
        if raw_get(ship_id, BANDWIDTH) <= 0 and raw_get(ship_id, BAY) <= 0:
            return None
        return rule

    def _project_attribute(self, location, raw_get, item_id, attribute_id, value):
        # Future Solo projections join this dispatch, using raw_get for native
        # eligibility. They must not install a second getter or own teardown.
        if attribute_id not in (BANDWIDTH, BAY, MAX_ACTIVE) or item_id != location.GetCurrentShipID():
            return value
        rule = self._rule(location, raw_get)
        if rule is None:
            return value
        if attribute_id == MAX_ACTIVE:
            return rule[2] if rule[2] is not None else value
        return value * rule[0 if attribute_id == BANDWIDTH else 1] if value > 0 else value

    def attach(self, location):
        if not isinstance(location, self.fitting_class) or any(ref() is location for ref, _ in self.records):
            return
        raw_get = location.GetAttributeValue
        raw_max = location.GetMaxActiveDrones
        tracker = location.selectedDronesTracker
        raw_register = tracker.RegisterDroneAsActive
        # A third-party tracker implementation is outside the verified seam.
        function = getattr(raw_register, 'im_func', getattr(raw_register, '__func__', None))
        if function is not self.native_tracker_method:
            return
        owner = self

        def get_attribute(instance, item_id, attribute_id):
            value = raw_get(item_id, attribute_id)
            try:
                return owner._project_attribute(instance, raw_get, item_id, attribute_id, value)
            except Exception:
                return value

        def get_max(instance):
            try:
                rule = owner._rule(instance, raw_get)
                if rule is not None and rule[2] is not None:
                    return rule[2]
            except Exception:
                pass
            return raw_max()

        def register(instance, dogma_location, drone_id, qty=1, raiseError=True):
            try:
                rule = owner._rule(location, raw_get) if dogma_location is location else None
            except Exception:
                rule = None
            if rule is None or rule[2] is None:
                return raw_register(dogma_location, drone_id, qty=qty, raiseError=raiseError)
            # Replace only the exact-count branch, including the native second
            # minimum-five check. Retain native bandwidth arithmetic and errors.
            if isinstance(qty, bool) or not isinstance(qty, INTEGER_TYPES) or qty <= 0:
                return
            selected = instance.selectedDronesDict
            limit = rule[2]
            if sum(selected.values()) + qty > limit:
                if raiseError:
                    owner.warning('count', limit)
                return
            used = sum(number * dogma_location.GetAttributeValue(item, owner.bandwidth_used_attribute)
                       for item, number in selected.items())
            needed = qty * dogma_location.GetAttributeValue(drone_id, owner.bandwidth_used_attribute)
            if needed + used > dogma_location.GetAttributeValue(dogma_location.GetCurrentShipID(), BANDWIDTH):
                if raiseError:
                    owner.warning('bandwidth', limit)
                return
            selected[drone_id] += qty

        changes = []
        try:
            for obj, name, function in ((location, 'GetAttributeValue', get_attribute),
                                        (location, 'GetMaxActiveDrones', get_max),
                                        (tracker, 'RegisterDroneAsActive', register)):
                previous = obj.__dict__.get(name)
                had_own = name in obj.__dict__
                installed = _bind(function, obj)
                setattr(obj, name, installed)
                changes.append((weakref.ref(obj), name, previous, had_own, installed))
        except Exception:
            self._restore(changes)
            raise
        self.records.append((weakref.ref(location), changes))
        # Existing selections came from native constraints. Revalidate only a
        # changed hull, deterministically, without ever touching live drones.
        rule = self._rule(location, raw_get)
        if rule is not None:
            remaining = location.GetMaxActiveDrones()
            bandwidth = location.GetAttributeValue(location.GetCurrentShipID(), BANDWIDTH)
            for item in sorted(list(tracker.selectedDronesDict), key=str):
                count = tracker.selectedDronesDict[item]
                per_drone = location.GetAttributeValue(item, self.bandwidth_used_attribute)
                keep = min(count, remaining)
                if per_drone > 0:
                    keep = min(keep, max(0, int(bandwidth / per_drone)))
                if keep > 0:
                    tracker.selectedDronesDict[item] = keep
                else:
                    tracker.selectedDronesDict.pop(item, None)
                remaining -= keep
                bandwidth -= keep * per_drone

    def _restore(self, changes):
        for reference, name, previous, had_own, installed in reversed(changes):
            try:
                obj = reference()
                if obj is None or obj.__dict__.get(name) is not installed:
                    continue
                if had_own:
                    setattr(obj, name, previous)
                else:
                    delattr(obj, name)
            except Exception:
                # Retired UI objects must not prevent other hooks being restored.
                pass

    def dispose(self):
        self.active = False
        changed_locations = []
        for reference, _ in self.records:
            try:
                location = reference()
                if location is not None:
                    ship = location.dogmaItems.get(location.GetCurrentShipID())
                    if ship is not None and int(ship.typeID) in (self.rules or {}):
                        changed_locations.append(location)
            except Exception:
                pass
        if self.init_wrapper is not None and self.fitting_class.__dict__.get('__init__') is self.init_wrapper:
            self.fitting_class.__init__ = self.original_init
        if self.picker_wrapper is not None and self.picker_class.__dict__.get('GetMaxActiveDrones') is self.picker_wrapper:
            self.picker_class.GetMaxActiveDrones = self.original_picker_max
        for _, changes in reversed(self.records):
            self._restore(changes)
        self.records = []
        # A preview selected under an expanded limit must not retain an invalid
        # count after teardown. Only ghost selections are adjusted.
        for location in changed_locations:
            try:
                remaining = location.GetMaxActiveDrones()
                bandwidth = location.GetAttributeValue(location.GetCurrentShipID(), BANDWIDTH)
                selected = location.selectedDronesTracker.selectedDronesDict
                for item in sorted(list(selected), key=str):
                    per_drone = location.GetAttributeValue(item, self.bandwidth_used_attribute)
                    keep = min(selected[item], remaining)
                    if per_drone > 0:
                        keep = min(keep, max(0, int(bandwidth / per_drone)))
                    if keep > 0:
                        selected[item] = keep
                    else:
                        selected.pop(item, None)
                    remaining -= keep
                    bandwidth -= keep * per_drone
            except Exception:
                # Never let teardown interfere with character logout.
                pass
