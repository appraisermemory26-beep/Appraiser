from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_user_middle_name"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="employment_status",
            field=models.CharField(
                choices=[
                    ("ACTIVE", "Active"),
                    ("PROBATION", "Probation"),
                    ("PROMOTED", "Promoted"),
                    ("DEMOTED", "Demoted"),
                    ("SUSPENDED", "Suspended"),
                    ("RESIGNED", "Resigned"),
                    ("TERMINATED", "Terminated"),
                    ("CONTRACT_ENDED", "Contract Ended"),
                ],
                default="ACTIVE",
                max_length=20,
            ),
        ),
    ]
