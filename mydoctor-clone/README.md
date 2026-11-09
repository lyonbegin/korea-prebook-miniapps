# MyDoctor full-parity target (work in progress)

Branch: feature/mydoctor-full-clone-20261109
Source: https://my-doctor.io/
Existing repository: lyonbegin/korea-prebook-miniapps
Railway: thriving-education
Services: mydoctor-mobile-web, mydoctor-mobile-api
Database: EXISTING pgvector, independent schema mydoctor_clone

Development follows the original UNNI branch's workflow: inspect actual public
source, implement matching screens and data, compare mobile screenshots using
Playwright, fix deviations and repeat. No test passes merely because it clicked a
button. No test data is described as real patient/provider data.

Original customer account, prescription, booking, transaction and medical records
are not copied. The independent study app must never say a medical booking was
confirmed without an actual authorized transaction.

## Implementation status
Initial independent React/FastAPI source gateway, public metadata schema,
public home/department/hospital/price reading and mobile QA are implemented.
Full UI/UX parity remains an explicit, **unpassed** target; source-parity
captures honest pixel differences and UNVERIFIED source access.
