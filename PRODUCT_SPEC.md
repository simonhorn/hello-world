# Heart Monitor Product Specification

## Locked Concept: Place / Activity Context

Status: LOCKED for the build unless explicitly revised.

### Design principle
GPS is not itself part of the clinical record. GPS is used temporarily to recognize a patient-defined place or context.

### Intended workflow
1. The app may request device location when the user records an event.
2. If the approximate location matches a place the user has named before, the app suggests that saved place name.
3. If the location is new, the app asks the user to identify it with a useful label such as Home, Work, Gym, Church, Movie Theatre, Tennis Court, etc.
4. The user can confirm or change the suggested place name.
5. The event record retains the user-friendly place/context name for clinical review.
6. Exact GPS coordinates are not included in the normal doctor/Boston Scientific export.
7. Exact coordinates should not be retained in the event once the place has been resolved, except where technically necessary for a local-only recognition table.
8. Any local recognition table containing coordinates remains on the patient's device and is excluded from clinical exports.

### Separate fields
Place and Activity are distinct:
- Place: Home, Gym, Work, Church, Movie Theatre, etc.
- Activity: Sitting, Walking, Exercising, Mowing, Treadmill, Weights, Eating, Sleeping, etc.

### Clinical rationale
The clinically useful information is the context around the ECG event, not the patient's precise coordinates. Examples:
- Place: Gym; Activity: Treadmill
- Place: Home; Activity: Mowing lawn
- Place: Movie Theatre; Activity: Sitting
- Place: Home; Activity: Sleeping

### Privacy principle
"We don't track where the patient is. We remember what the patient calls that place."

