from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organisations", "0002_alter_organisation_organogram_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="organisation",
            name="organogram_parse_status",
            field=models.CharField(
                choices=[
                    ("NOT_PARSED", "Not Parsed"),
                    ("PARSING", "Parsing"),
                    ("PARSED", "Parsed"),
                    ("FAILED", "Failed"),
                ],
                default="NOT_PARSED",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="organisation",
            name="organogram_structure",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="organisation",
            name="organogram_parsed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
