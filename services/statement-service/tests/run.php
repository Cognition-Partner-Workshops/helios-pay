<?php

declare(strict_types=1);

/*
 * Regression tests for the statement-service.
 *
 * The version-logic checks are portable. The runtime checks run inside the
 * service image (STATEMENT_RUNTIME_CHECKS=1) and fail if the image ships a PHP
 * build affected by PHP2Shell (CVE-2026-109618, CVE-2026-109619).
 */

require __DIR__ . '/../src/Version.php';
require __DIR__ . '/../src/RemittanceStore.php';

use Helios\StatementService\RemittanceStore;
use Helios\StatementService\Version;

$failures = 0;

function check(string $name, bool $ok): void
{
    global $failures;
    if ($ok) {
        echo "PASS  $name\n";
        return;
    }
    echo "FAIL  $name\n";
    $failures++;
}

// Affected-version detection logic.
check('8.5.11 is affected', Version::isAffected('8.5.11'));
check('8.5.12 is patched', !Version::isAffected('8.5.12'));
check('8.4.26 is affected', Version::isAffected('8.4.26'));
check('8.4.27 is patched', !Version::isAffected('8.4.27'));
check('7.4.33 is affected', Version::isAffected('7.4.33'));
check('patched floor for 8.5.x', Version::patchedFloorFor('8.5.11') === '8.5.12');

// Runtime-bound checks: only meaningful on the service's own image, so they are
// gated behind STATEMENT_RUNTIME_CHECKS (set in the Dockerfile).
if (getenv('STATEMENT_RUNTIME_CHECKS') === '1') {
    check('runtime ' . PHP_VERSION . ' is not an affected PHP build', !Version::isAffected(PHP_VERSION));

    // Hardening from conf/php.ini (defence in depth, not the fix).
    check('session.upload_progress.enabled is off', !((bool) ini_get('session.upload_progress.enabled')));
    check('display_errors is off', !filter_var(ini_get('display_errors'), FILTER_VALIDATE_BOOLEAN));
    check('expose_php is off', !((bool) ini_get('expose_php')));
} else {
    echo "SKIP  runtime/ini checks (set STATEMENT_RUNTIME_CHECKS=1 on the service image)\n";
}

// The remittance capability parses an advice CSV.
$record = (new RemittanceStore(sys_get_temp_dir() . '/stmt-test-' . bin2hex(random_bytes(4))))
    ->importCsv('partner-acme', "invoiceRef,amountCents,currency\nINV-1,1000,USD\nINV-2,2500,USD\n");
check('CSV import parses line items', $record['lineItemCount'] === 2);
check('CSV import totals amounts', $record['totalCents'] === 3500);

echo "\n";
if ($failures > 0) {
    echo "$failures check(s) failed\n";
    exit(1);
}
echo "all checks passed\n";
