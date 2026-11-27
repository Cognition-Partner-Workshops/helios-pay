<?php

declare(strict_types=1);

namespace Helios\StatementService;

/**
 * PHP2Shell (CVE-2026-109618, CVE-2026-109619) affected-runtime detection.
 *
 * Both CVEs are fixed in PHP 8.2.35, 8.3.36, 8.4.27 and 8.5.12. A runtime is
 * affected when its version is below the patched floor for its own branch.
 * This is the "affected-version detection" half of the runtime validation.
 */
final class Version
{
    /** Patched floor per PHP branch (from the php.net advisory). */
    private const PATCHED_FLOORS = [
        '8.2' => '8.2.35',
        '8.3' => '8.3.36',
        '8.4' => '8.4.27',
        '8.5' => '8.5.12',
    ];

    public static function runtimeVersion(): string
    {
        return PHP_VERSION;
    }

    public static function patchedFloorFor(string $phpVersion): ?string
    {
        $branch = self::branchOf($phpVersion);

        if (isset(self::PATCHED_FLOORS[$branch])) {
            return self::PATCHED_FLOORS[$branch];
        }

        // Branches older than 8.2 (incl. 5.4+, 7.x, 8.0, 8.1) are all affected.
        if (version_compare($phpVersion, '8.2.0', '<')) {
            return '8.2.35';
        }

        return null;
    }

    public static function isAffected(string $phpVersion): bool
    {
        $floor = self::patchedFloorFor($phpVersion);

        if ($floor === null) {
            return false;
        }

        return version_compare($phpVersion, $floor, '<');
    }

    public static function report(?string $phpVersion = null): array
    {
        $phpVersion ??= self::runtimeVersion();

        return [
            'phpVersion' => $phpVersion,
            'patchedFloor' => self::patchedFloorFor($phpVersion),
            'affected' => self::isAffected($phpVersion),
            'cves' => ['CVE-2026-109618', 'CVE-2026-109619'],
            'name' => 'PHP2Shell',
        ];
    }

    private static function branchOf(string $phpVersion): string
    {
        $parts = explode('.', $phpVersion);

        return ($parts[0] ?? '0') . '.' . ($parts[1] ?? '0');
    }
}
