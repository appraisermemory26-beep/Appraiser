# Run this from the BACKEND folder.
# Piece 1 of Strict Mode auto-sign-off: records WHO consented to switch an
# organisation into Strict Mode and WHEN. Turning Strict Mode back off
# clears that consent, so re-enabling it later asks again.
#
# Changes:
#   - apps/organisations/models.py   : two new fields on Organisation
#   - apps/organisations/serializers.py : expose them as read-only
#   - apps/organisations/views.py    : stamp/clear them on the mode toggle

$modelsPath = Join-Path (Get-Location) "apps\organisations\models.py"
$modelsRaw = Get-Content -LiteralPath $modelsPath -Raw -Encoding UTF8
$modelsNorm = $modelsRaw -replace "`r`n", "`n"

$oldModelsA = @'
    attendance_enforced = models.BooleanField(default=True, help_text="If off, staff enter Timesheet hours manually instead of clocking in/out.")
'@
$oldModelsALf = $oldModelsA -replace "`r`n", "`n"
$okModelsA = $modelsNorm.Contains($oldModelsALf)
Write-Host "Anchor A (attendance_enforced field) found:" $okModelsA

$hasSettingsImport = $modelsNorm.Contains("from django.conf import settings")
Write-Host "settings already imported in models.py:" $hasSettingsImport

if ($okModelsA) {
    $newModelsA = @'
    attendance_enforced = models.BooleanField(default=True, help_text="If off, staff enter Timesheet hours manually instead of clocking in/out.")
    strict_mode_consented_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
        help_text="Who gave the one-time consent to switch this organisation into Strict Mode.",
    )
    strict_mode_consented_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When Strict Mode consent was last given. Cleared if Strict Mode is turned off.",
    )
'@
    $newModelsALf = $newModelsA -replace "`r`n", "`n"
    $modelsNorm = $modelsNorm.Replace($oldModelsALf, $newModelsALf)

    if (-not $hasSettingsImport) {
        # Insert the import right after the first "from django.db import models" line.
        $oldImport = "from django.db import models`n"
        if ($modelsNorm.Contains($oldImport)) {
            $newImport = "from django.conf import settings`nfrom django.db import models`n"
            $modelsNorm = $modelsNorm.Replace($oldImport, $newImport)
            Write-Host "Added 'from django.conf import settings' import to models.py."
        } else {
            Write-Host "WARNING - could not find 'from django.db import models' to anchor the new import. Add 'from django.conf import settings' to models.py manually."
        }
    }

    $modelsUpdated = $modelsNorm -replace "`n", "`r`n"
    $utf8Models = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($modelsPath, $modelsUpdated, $utf8Models)
    Write-Host "models.py: strict_mode_consented_by / strict_mode_consented_at fields added."
} else {
    Write-Host "WARNING - anchor missing in models.py, NO changes made there."
}

# --------------------------------------------------------------------------

$serPath = Join-Path (Get-Location) "apps\organisations\serializers.py"
$serRaw = Get-Content -LiteralPath $serPath -Raw -Encoding UTF8
$serNorm = $serRaw -replace "`r`n", "`n"

$oldSer = @'
        fields = [
            "id", "name", "slug", "logo", "address", "phone", "email", "website",
            "is_setup_complete", "attendance_enforced", "organogram_file",
            "organogram_parse_status", "organogram_structure", "organogram_parsed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organogram_parse_status", "organogram_structure", "organogram_parsed_at", "created_at", "updated_at"]
'@
$oldSerLf = $oldSer -replace "`r`n", "`n"
$okSer = $serNorm.Contains($oldSerLf)
Write-Host "Anchor (OrganisationSerializer fields) found:" $okSer

if ($okSer) {
    $newSer = @'
        fields = [
            "id", "name", "slug", "logo", "address", "phone", "email", "website",
            "is_setup_complete", "attendance_enforced", "organogram_file",
            "organogram_parse_status", "organogram_structure", "organogram_parsed_at",
            "strict_mode_consented_by", "strict_mode_consented_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "organogram_parse_status", "organogram_structure", "organogram_parsed_at",
            "strict_mode_consented_by", "strict_mode_consented_at",
            "created_at", "updated_at",
        ]
'@
    $newSerLf = $newSer -replace "`r`n", "`n"
    $serNorm = $serNorm.Replace($oldSerLf, $newSerLf)
    $serUpdated = $serNorm -replace "`n", "`r`n"
    $utf8Ser = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($serPath, $serUpdated, $utf8Ser)
    Write-Host "serializers.py: new fields exposed as read-only."
} else {
    Write-Host "WARNING - anchor missing in serializers.py, NO changes made there."
}

# --------------------------------------------------------------------------

$viewsPath = Join-Path (Get-Location) "apps\organisations\views.py"
$viewsRaw = Get-Content -LiteralPath $viewsPath -Raw -Encoding UTF8
$viewsNorm = $viewsRaw -replace "`r`n", "`n"

$oldViews = @'
    def perform_update(self, serializer):
        old_org = self.get_object()
        old_organogram = old_org.organogram_file or None
        instance = serializer.save()
        new_organogram = instance.organogram_file or None
'@
$oldViewsLf = $oldViews -replace "`r`n", "`n"
$okViews = $viewsNorm.Contains($oldViewsLf)
Write-Host "Anchor (perform_update) found:" $okViews

if ($okViews) {
    $newViews = @'
    def perform_update(self, serializer):
        old_org = self.get_object()
        old_organogram = old_org.organogram_file or None
        was_strict = old_org.attendance_enforced
        instance = serializer.save()
        new_organogram = instance.organogram_file or None

        # Strict Mode is a one-time supervisor consent: stamp who/when it was
        # switched ON, and clear that consent if it's switched back OFF so
        # turning it on again later asks for consent afresh.
        if instance.attendance_enforced and not was_strict:
            instance.strict_mode_consented_by = self.request.user
            instance.strict_mode_consented_at = timezone.now()
            instance.save(update_fields=["strict_mode_consented_by", "strict_mode_consented_at"])
            AuditLog.objects.create(
                event_type="strict_mode_consented",
                event_category="ADMINISTRATIVE",
                user=self.request.user,
                organisation=self.request.user.organisation,
                description=f"{self.request.user} consented to switch '{instance.name}' into Strict Mode.",
                entity_type="organisation",
                entity_id=instance.id,
            )
        elif not instance.attendance_enforced and was_strict:
            instance.strict_mode_consented_by = None
            instance.strict_mode_consented_at = None
            instance.save(update_fields=["strict_mode_consented_by", "strict_mode_consented_at"])
'@
    $newViewsLf = $newViews -replace "`r`n", "`n"
    $viewsNorm = $viewsNorm.Replace($oldViewsLf, $newViewsLf)
    $viewsUpdated = $viewsNorm -replace "`n", "`r`n"
    $utf8Views = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($viewsPath, $viewsUpdated, $utf8Views)
    Write-Host "views.py: consent stamped on enable, cleared on disable."
} else {
    Write-Host "WARNING - anchor missing in views.py, NO changes made there."
}
