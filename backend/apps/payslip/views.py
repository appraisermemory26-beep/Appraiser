from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember
from apps.timesheet.models import Timesheet

from .models import Payslip
from .serializers import PayslipSerializer
from .services import PayslipGenerationError, generate_payslip, toggle_privacy


class PayslipViewSet(viewsets.ModelViewSet):
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Payslip.objects.filter(organisation=user.organisation)
        if user.role == "STAFF":
            return qs.filter(user_id=user.id)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id])
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id])
        return qs

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        requester = request.user
        if requester.role == "STAFF":
            return Response({"error": "Staff cannot generate Payslips."}, status=403)

        timesheet_id = request.data.get("timesheet")
        if not timesheet_id:
            return Response({"error": "timesheet is required."}, status=400)
        try:
            timesheet = Timesheet.objects.get(pk=timesheet_id, organisation=requester.organisation)
        except Timesheet.DoesNotExist:
            return Response({"error": "Timesheet not found."}, status=404)

        try:
            payslip = generate_payslip(timesheet)
        except PayslipGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(PayslipSerializer(payslip).data)

    @action(detail=True, methods=["post"], url_path="toggle-privacy")
    def toggle_privacy_action(self, request, pk=None):
        payslip = self.get_object()
        if payslip.user_id != request.user.id:
            return Response({"error": "You can only change the privacy setting on your own Payslip."}, status=403)
        hidden = bool(request.data.get("hidden", not payslip.hidden_by_employee))
        payslip = toggle_privacy(payslip, hidden)
        return Response(PayslipSerializer(payslip).data)

    def update(self, request, *args, **kwargs):
        return Response({"error": "Payslips cannot be edited directly. Use toggle-privacy."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Payslips cannot be edited directly. Use toggle-privacy."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Payslips cannot be deleted."}, status=403)

    def create(self, request, *args, **kwargs):
        return Response({"error": "Use /generate to create a Payslip."}, status=403)