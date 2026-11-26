---
title: 'TIL: exclusion constraints'
kind: til
area: backend
summary: PostgreSQL can reject overlapping time ranges by itself.
updated: 2026-11-27
---

A unique constraint stops two equal values. An **exclusion constraint** stops two rows that conflict under an operator you choose, for example overlapping time ranges:

```sql
create extension if not exists btree_gist;

alter table bookings add constraint no_overlap
  exclude using gist (bay_id with =, during with &&);
```

`&&` means "overlaps". Two bookings for the same bay with overlapping `during` ranges can no longer both exist, however the application races.
