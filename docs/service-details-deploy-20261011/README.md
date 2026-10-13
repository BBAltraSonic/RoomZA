# Service details release status

The Service details changes were deployed on 12 October 2026 in the combined
release, Worker `8cc19081-194e-4c21-91a9-630992d97fcc`, at 100% traffic.

The original isolated artifact in this directory was not separately deployed;
its source was combined with Google sign-in and Special galleries while
preserving the nationwide catalogue.

Both existing approved public Service details return HTTP 200 and exclude draft
data. Invalid IDs return 400 and missing IDs return 404. All responses contain the
`no-store` directive; Next.js adds stronger private/no-cache directives to some
error responses. The initial HTTP verification asserted an exact `no-store`
header for invalid IDs, which was too narrow. The corrected directive check
passes without an application change or a second deployment.

See [combined production release evidence](../all-work-deploy-20261012/README.md).
