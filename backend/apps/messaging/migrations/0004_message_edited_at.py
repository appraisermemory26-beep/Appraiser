from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0003_message_messaging_m_organis_386cd4_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="edited_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
