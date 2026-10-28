# Run this from the FRONTEND folder (frontend\web).
# Piece 1 (frontend half): clicking to turn Strict Mode ON now opens a
# confirmation modal explaining what it means, instead of switching
# immediately. Turning it back OFF stays a single click (no consent
# needed to loosen controls). The backend already records who confirmed
# and when.

$pPath = Join-Path (Get-Location) "src\app\(dashboard)\timesheets\page.tsx"
$pRaw = Get-Content -LiteralPath $pPath -Raw -Encoding UTF8
$pNorm = $pRaw -replace "`r`n", "`n"

$oldA = @'
  const [togglingMode, setTogglingMode] = useState(false);
'@
$oldALf = $oldA -replace "`r`n", "`n"
$okA = $pNorm.Contains($oldALf)
Write-Host "Anchor A (togglingMode state) found:" $okA

$oldB = @'
        <div
          className={`ts-modetoggle ${isStrict ? "ts-strict" : "ts-alt"} ${isAdmin ? "ts-clickable" : "ts-readonly"}`}
          onClick={isAdmin ? handleToggleMode : undefined}
          title={isAdmin ? "Click to switch mode (organisation-wide)" : "Set by your organisation's Admin"}
        >
          {togglingMode ? "Updating…" : isStrict ? "🔒 Strict Mode" : "📝 Alternative Mode"}
        </div>
      </div>

      {!isStrict && (
'@
$oldBLf = $oldB -replace "`r`n", "`n"
$okB = $pNorm.Contains($oldBLf)
Write-Host "Anchor B (mode toggle div) found:" $okB

if ($okA -and $okB) {
    $newA = @'
  const [togglingMode, setTogglingMode] = useState(false);
  const [showStrictConsent, setShowStrictConsent] = useState(false);
'@
    $newALf = $newA -replace "`r`n", "`n"
    $pNorm = $pNorm.Replace($oldALf, $newALf)

    $newB = @'
        <div
          className={`ts-modetoggle ${isStrict ? "ts-strict" : "ts-alt"} ${isAdmin ? "ts-clickable" : "ts-readonly"}`}
          onClick={isAdmin ? (isStrict ? handleToggleMode : () => setShowStrictConsent(true)) : undefined}
          title={isAdmin ? "Click to switch mode (organisation-wide)" : "Set by your organisation's Admin"}
        >
          {togglingMode ? "Updating…" : isStrict ? "🔒 Strict Mode" : "📝 Alternative Mode"}
        </div>
      </div>

      <Modal isOpen={showStrictConsent} onClose={() => setShowStrictConsent(false)} title="Enable Strict Mode">
        <div className="space-y-4">
          <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5 }}>
            Strict Mode turns on automated attendance tracking for your organisation. Going forward, once the
            monthly approval deadline passes, the system will automatically sign off every employee&apos;s
            still-pending timesheet instead of waiting for a manual click-through.
          </p>
          <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5 }}>
            This is a one-time consent as the organisation&apos;s Admin. Your name and the date will be recorded
            against this decision. You can switch back to Alternative Mode at any time, which will clear this
            consent.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={() => setShowStrictConsent(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                setShowStrictConsent(false);
                await handleToggleMode();
              }}
              disabled={togglingMode}
            >
              {togglingMode ? "Enabling…" : "I Consent — Enable Strict Mode"}
            </Button>
          </div>
        </div>
      </Modal>

      {!isStrict && (
'@
    $newBLf = $newB -replace "`r`n", "`n"
    $pNorm = $pNorm.Replace($oldBLf, $newBLf)

    $pUpdated = $pNorm -replace "`n", "`r`n"
    $utf8P = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($pPath, $pUpdated, $utf8P)
    Write-Host "timesheets/page.tsx: Strict Mode consent modal added."
} else {
    Write-Host "WARNING - anchor(s) missing, NO changes made."
}
