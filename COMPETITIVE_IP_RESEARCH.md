# Heart Monitor — Competitive / IP Gap Analysis
Date: 2026-09-29
Status: Preliminary research memo; not a legal patentability or freedom-to-operate opinion.

## Core finding
The market already contains digital cardiac symptom diaries and symptom–ECG correlation. The strongest commercial opportunity is not "an electronic diary" in the abstract. It is a BodyGuardian MINI-specific patient companion that replaces the current paper diary, uses the patient's own phone, captures structured symptom/activity/context data, and delivers that data into Boston Scientific's existing PatientCare/reporting workflow.

## Boston Scientific / BodyGuardian
- Current BodyGuardian MINI materials still use a paper Holter diary for date/time, symptom and activity.
- BodyGuardian MINI PLUS has BodyGuardian Connect and digital symptom capture, but public current materials do not show the same richer patient activity/place/narrative workflow for MINI.
- Boston Scientific already operates BodyGuardian Connect, PatientCare Platform, PatientCare Link and ECG Plug-In software.
- Boston Scientific already correlates patient-triggered events/symptoms with ECG in its reporting workflow.
- Boston Scientific has an active voice-control patent (US11501879B2), so voice entry alone should not be treated as the core novelty.

## Competitive landscape
- iRhythm MyZio: own-phone mobile app, symptom logging, activity at time of symptom, entries flow into Zio reports.
- VitalConnect / VistaCenter: patient symptom entry, activity level, "Other" description, clinician display alongside ECG, CSV export.
- Zoll: patents around contextual biometric information for cardiac arrhythmia events, including motion/posture/activity context.
- Philips: 2026 pending US application on correlating patient-perceived symptoms with ECG data/display; earlier work describes symptom + activity entry.
- Prior systems have also described symptom, activity and location/context concepts.

## Location / semantic-place concept
Locked design:
- GPS is an input mechanism, not part of the clinical record.
- On first encounter with a location, user assigns a semantic place label (Home, Gym, Church, Movie Theatre, etc.).
- Later events at that approximate location suggest the saved label.
- Event export contains the semantic label, not latitude/longitude.
- Coordinate lookup data remains local-only and is excluded from clinical exports.
- Place and Activity remain separate fields.

Preliminary IP view:
- Semantic patient location is not new in the broad sense. Published patent literature exists for semantic patient location and remote monitoring.
- GPS-to-semantic-location techniques also exist generally.
- I did not identify, in this preliminary search, the exact combination of patient-named place memory + temporary GPS matching + deletion/withholding of exact coordinates + ambulatory ECG symptom diary + integration into a Holter report.
- Because neighboring prior art is close, broad patent claims would likely be difficult. A narrow implementation/workflow claim may still be worth professional patent review.

## Commercial thesis
Best pitch:
"BodyGuardian MINI still relies on a paper symptom/activity diary. This prototype gives MINI patients a bring-your-own-phone companion that captures precise event timing, symptom, activity, patient-defined contextual place and notes, then supplies structured patient context to Boston Scientific for direct correlation with the returned ECG."

Potential value:
- reduce missing/illegible diary entries
- improve timestamp precision
- improve symptom–rhythm correlation
- add clinically useful activity/context
- reduce paper handling/data-entry burden
- compete with own-phone workflows such as MyZio
- leverage Boston Scientific's existing PatientCare/report infrastructure

## Important outreach warning
Do not casually email or send the concept to Boston Scientific.
Boston Scientific's innovation portal states that initial submissions are non-confidential. Their CDx site terms also warn against unsolicited ideas/materials. Protect the concept and choose the formal submission route deliberately.

## Recommended sequence
1. Finish a controlled prototype focused on event capture, safe deletion, semantic place recognition and structured export.
2. Document exactly what is new versus BodyGuardian MINI, MINI PLUS, MyZio, VitalConnect, Zoll and Philips.
3. Prepare a concise invention disclosure with dated screenshots, workflow diagrams and source code history.
4. Before revealing implementation details to Boston Scientific, get a patent attorney to perform a focused novelty/FTO review and decide whether a provisional application is worthwhile.
5. After protection strategy is settled, approach Boston Scientific through its formal innovation portal using only non-confidential material until a confidentiality agreement exists.
