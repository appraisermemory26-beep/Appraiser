# Run this from the BACKEND folder.
# Foundation piece of the Signature module:
#   - apps/accounts/models.py      : signature image + hashed Signature PIN
#                                     + lockout fields on User
#   - apps/accounts/serializers.py : expose signature (read-only) +
#                                     has_signature / has_signature_pin
#   - apps/accounts/views.py       : POST .../me/signature/ to register
#                                     (requires agreement + sets PIN)
#                                     POST .../me/signature/verify-pin/
#                                     to check the PIN before using it,
#                                     with a 5-strikes / 15-minute lockout
#                                     and a full audit trail either way.
#
# The PIN itself is NEVER stored - only its hash (same technique used for
# account passwords), and no signature is saved without the agreement
# being explicitly accepted in the same request.

$modelsPath = Join-Path (Get-Location) "apps\accounts\models.py"
$modelsRaw = Get-Content -LiteralPath $modelsPath -Raw -Encoding UTF8
$modelsNorm = $modelsRaw -replace "`r`n", "`n"

$oldModels = @'
    avatar = models.ImageField(upload_to="avatars/", blank=True)
'@
$oldModelsLf = $oldModels -replace "`r`n", "`n"
$okModels = $modelsNorm.Contains($oldModelsLf)
Write-Host "Anchor A (avatar field) found:" $okModels

if ($okModels) {
    $newModels = @'
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    signature = models.ImageField(
        upload_to="signatures/", blank=True,
        help_text="Personal signature image, used to sign documents such as timesheets.",
    )
    signature_consented_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the user agreed to the signature usage terms. Cleared if the signature is replaced.",
    )
    signature_pin_hash = models.CharField(
        max_length=128, blank=True,
        help_text="Hashed PIN required to apply the signature to a document. The PIN itself is never stored.",
    )
    signature_pin_failed_attempts = models.PositiveIntegerField(default=0)
    signature_pin_locked_until = models.DateTimeField(null=True, blank=True)
'@
    $newModelsLf = $newModels -replace "`r`n", "`n"
    $modelsNorm = $modelsNorm.Replace($oldModelsLf, $newModelsLf)
    $modelsUpdated = $modelsNorm -replace "`n", "`r`n"
    $utf8Models = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($modelsPath, $modelsUpdated, $utf8Models)
    Write-Host "models.py: signature + PIN + lockout fields added to User."
} else {
    Write-Host "WARNING - anchor missing in models.py, NO changes made there."
}

# --------------------------------------------------------------------------

$serPath = Join-Path (Get-Location) "apps\accounts\serializers.py"
$serRaw = Get-Content -LiteralPath $serPath -Raw -Encoding UTF8
$serNorm = $serRaw -replace "`r`n", "`n"

$oldSer = @'
class UserSerializer(serializers.ModelSerializer):
    succeeded_by_name = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "middle_name", "last_name", "full_name",
            "role", "employment_status", "organisation", "department",
            "reports_to", "phone", "avatar", "job_title",
            "succeeded_by", "succeeded_by_name",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "employment_status", "full_name", "succeeded_by_name",
            "created_at", "updated_at",
        ]
'@
$oldSerLf = $oldSer -replace "`r`n", "`n"
$okSer = $serNorm.Contains($oldSerLf)
Write-Host "Anchor (UserSerializer) found:" $okSer

if ($okSer) {
    $newSer = @'
class UserSerializer(serializers.ModelSerializer):
    succeeded_by_name = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)
    has_signature = serializers.SerializerMethodField()
    has_signature_pin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "middle_name", "last_name", "full_name",
            "role", "employment_status", "organisation", "department",
            "reports_to", "phone", "avatar", "job_title",
            "succeeded_by", "succeeded_by_name",
            "signature", "signature_consented_at", "has_signature", "has_signature_pin",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "employment_status", "full_name", "succeeded_by_name",
            "signature", "signature_consented_at", "has_signature", "has_signature_pin",
            "created_at", "updated_at",
        ]

    def get_has_signature(self, obj):
        return bool(obj.signature)

    def get_has_signature_pin(self, obj):
        return bool(obj.signature_pin_hash)
'@
    $newSerLf = $newSer -replace "`r`n", "`n"
    $serNorm = $serNorm.Replace($oldSerLf, $newSerLf)
    $serUpdated = $serNorm -replace "`n", "`r`n"
    $utf8Ser = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($serPath, $serUpdated, $utf8Ser)
    Write-Host "serializers.py: signature fields exposed (read-only)."
} else {
    Write-Host "WARNING - anchor missing in serializers.py, NO changes made there."
}

# --------------------------------------------------------------------------

$viewsPath = Join-Path (Get-Location) "apps\accounts\views.py"
$viewsRaw = Get-Content -LiteralPath $viewsPath -Raw -Encoding UTF8
$viewsNorm = $viewsRaw -replace "`r`n", "`n"

$hasTimezoneImport = $viewsNorm.Contains("from django.utils import timezone")
Write-Host "timezone already imported in views.py:" $hasTimezoneImport

if (-not $hasTimezoneImport) {
    $oldImport = "from django.conf import settings`n"
    if ($viewsNorm.Contains($oldImport)) {
        $newImport = "from django.conf import settings`nfrom django.utils import timezone`n"
        $viewsNorm = $viewsNorm.Replace($oldImport, $newImport)
        Write-Host "Added 'from django.utils import timezone' import to views.py."
    } else {
        Write-Host "WARNING - could not find anchor to add timezone import. Add it manually."
    }
}

$oldViews = @'
    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
'@
$oldViewsLf = $oldViews -replace "`r`n", "`n"
$okViews = $viewsNorm.Contains($oldViewsLf)
Write-Host "Anchor (me action) found:" $okViews

if ($okViews) {
    $newViews = @'
    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(
        detail=False, methods=["post"], url_path="me/signature",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_signature(self, request):
        """Register the caller's personal signature image and set their
        Signature PIN in one step. Nothing is saved unless the signature
        usage agreement is explicitly accepted in this same request."""
        from django.contrib.auth.hashers import make_password

        user = request.user
        agreement_accepted = str(request.data.get("agreement_accepted", "")).lower() in ("true", "1", "yes")
        if not agreement_accepted:
            return Response({"error": "You must accept the signature usage agreement."}, status=400)

        file = request.FILES.get("signature")
        if not file:
            return Response({"error": "No signature image was provided."}, status=400)

        pin = str(request.data.get("pin", ""))
        pin_confirm = str(request.data.get("pin_confirm", ""))
        if not (pin.isdigit() and 4 <= len(pin) <= 6):
            return Response({"error": "PIN must be 4 to 6 digits."}, status=400)
        if pin != pin_confirm:
            return Response({"error": "PIN and confirmation do not match."}, status=400)

        user.signature = file
        user.signature_consented_at = timezone.now()
        user.signature_pin_hash = make_password(pin)
        user.signature_pin_failed_attempts = 0
        user.signature_pin_locked_until = None
        user.save(update_fields=[
            "signature", "signature_consented_at", "signature_pin_hash",
            "signature_pin_failed_attempts", "signature_pin_locked_until",
        ])

        create_audit_log(
            event_type="signature_registered",
            event_category=AuditLog.EventCategory.USER_MANAGEMENT,
            user=user,
            organisation=user.organisation,
            description=f"{user} uploaded a signature and set a Signature PIN.",
            entity_type="user",
            entity_id=user.id,
        )
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="me/signature/verify-pin")
    def verify_signature_pin(self, request):
        """Check the caller's Signature PIN before letting them apply their
        signature to a document. Locks out for 15 minutes after 5 wrong
        attempts in a row, and every attempt - success or failure - is
        written to the audit log."""
        from django.contrib.auth.hashers import check_password

        user = request.user
        if not user.signature_pin_hash:
            return Response({"error": "No Signature PIN has been set yet."}, status=400)

        now = timezone.now()
        if user.signature_pin_locked_until and user.signature_pin_locked_until > now:
            remaining = int((user.signature_pin_locked_until - now).total_seconds() // 60) + 1
            return Response(
                {"error": f"Too many incorrect attempts. Try again in about {remaining} minute(s)."},
                status=423,
            )

        pin = str(request.data.get("pin", ""))
        valid = check_password(pin, user.signature_pin_hash)

        if valid:
            user.signature_pin_failed_attempts = 0
            user.signature_pin_locked_until = None
            user.save(update_fields=["signature_pin_failed_attempts", "signature_pin_locked_until"])
            create_audit_log(
                event_type="signature_pin_verified",
                event_category=AuditLog.EventCategory.AUTHENTICATION,
                user=user,
                organisation=user.organisation,
                description=f"{user} successfully verified their Signature PIN.",
                entity_type="user",
                entity_id=user.id,
            )
            return Response({"valid": True})

        user.signature_pin_failed_attempts += 1
        locked = user.signature_pin_failed_attempts >= 5
        if locked:
            user.signature_pin_locked_until = now + timezone.timedelta(minutes=15)
            user.signature_pin_failed_attempts = 0
        user.save(update_fields=["signature_pin_failed_attempts", "signature_pin_locked_until"])

        create_audit_log(
            event_type="signature_pin_locked" if locked else "signature_pin_failed",
            event_category=AuditLog.EventCategory.AUTHENTICATION,
            user=user,
            organisation=user.organisation,
            description=(
                f"{user} entered an incorrect Signature PIN"
                + (" and has been locked out for 15 minutes." if locked else ".")
            ),
            entity_type="user",
            entity_id=user.id,
        )
        status_code = 423 if locked else 400
        message = "Too many incorrect attempts. Locked for 15 minutes." if locked else "Incorrect PIN."
        return Response({"valid": False, "error": message}, status=status_code)
'@
    $newViewsLf = $newViews -replace "`r`n", "`n"
    $viewsNorm = $viewsNorm.Replace($oldViewsLf, $newViewsLf)
    $viewsUpdated = $viewsNorm -replace "`n", "`r`n"
    $utf8Views = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($viewsPath, $viewsUpdated, $utf8Views)
    Write-Host "views.py: signature upload + PIN verify actions added."
} else {
    Write-Host "WARNING - anchor missing in views.py, NO changes made there."
}
