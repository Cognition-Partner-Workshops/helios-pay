<?php

declare(strict_types=1);

/*
 * Static regression tests for the statement-service PHP2Shell demo.
 *
 * These run in CI on the service's own (affected) PHP runtime. They assert the
 * runtime ships below the patched floor, so bumping PHP to a fixed release
 * correctly breaks this test — the intended "the vulnerability is gone" signal
 * for an intentionally-vulnerable demo.
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

// Runtime-bound checks: only meaningful on the service's own affected image, so
// they are gated behind STATEMENT_RUNTIME_CHECKS (set in the Dockerfile). Generic
// CI runs the portable logic above against whatever PHP it has.
if (getenv('STATEMENT_RUNTIME_CHECKS') === '1') {
    // The service runtime must itself be an affected build (the demo precondition).
    check('runtime ' . PHP_VERSION . ' is an affected PHP build', Version::isAffected(PHP_VERSION));

    // The exploitation preconditions from the advisories must be configured.
    check('memory_limit is finite (controllable OOM)', (string) ini_get('memory_limit') !== '-1');
    check('session.upload_progress.enabled is on', (bool) ini_get('session.upload_progress.enabled'));
    check('session.upload_progress.cleanup is off', !((bool) ini_get('session.upload_progress.cleanup')));
} else {
    echo "SKIP  runtime/ini preconditions (set STATEMENT_RUNTIME_CHECKS=1 on the affected image)\n";
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
