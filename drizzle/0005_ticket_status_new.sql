-- Change default for new inbound tickets to 'new'
alter table tickets alter column status set default 'new';
