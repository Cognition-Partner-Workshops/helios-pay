# V15 dependency advisory

Run the repository's dependency scanners and inspect
`services/core-api/requirements.txt`. The pinned `PyYAML==5.3.1` is associated
with CVE-2020-14343, an unsafe loader code-execution advisory. This is
intentional synthetic demo data; do not use the dependency set for production.
