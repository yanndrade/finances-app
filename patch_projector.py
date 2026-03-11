import re

with open('packages/backend/src/finance_app/infrastructure/projector.py', 'r', encoding='utf-8') as f:
    content = f.read()

unified_movement_code = """
class UnifiedMovementRecord(Base):
    __tablename__ = "unified_movements"

    movement_id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String)
    origin_type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[int] = mapped_column(Integer)
    posted_at: Mapped[str] = mapped_column(String)
    competence_month: Mapped[str] = mapped_column(String)
    account_id: Mapped[str] = mapped_column(String)
    card_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_method: Mapped[str] = mapped_column(String)
    category_id: Mapped[str] = mapped_column(String)
    counterparty: Mapped[str | None] = mapped_column(String, nullable=True)
    lifecycle_status: Mapped[str] = mapped_column(String)
    edit_policy: Mapped[str] = mapped_column(String)
    parent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    group_id: Mapped[str | None] = mapped_column(String, nullable=True)
    transfer_direction: Mapped[str | None] = mapped_column(String, nullable=True)
    installment_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    installment_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_event_type: Mapped[str] = mapped_column(String)

"""

parts = content.split('class Projector:')
if len(parts) == 2:
    new_content = parts[0] + unified_movement_code + '\nclass Projector:' + parts[1]
    with open('packages/backend/src/finance_app/infrastructure/projector.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Projector patched with UnifiedMovementRecord.')
else:
    print('Error: Could not find class Projector:')

