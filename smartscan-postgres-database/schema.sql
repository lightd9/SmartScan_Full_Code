-- SmartScan base schema
--
-- Apply this file to an empty PostgreSQL database, then run:
--   (cd smartscan-backend-node && npm ci && npm run migrate)
-- The numbered backend migrations add constraints, wallet linkage, product
-- chain lifecycle, scan telemetry, audit records, and retention indexes.
-- Do not load the CSV fixtures into a production database.

BEGIN;

CREATE TABLE IF NOT EXISTS public.auth (
  id serial PRIMARY KEY,
  username varchar(50) NOT NULL,
  password varchar(255) NOT NULL,
  role varchar(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profile (
  id serial PRIMARY KEY,
  username varchar(50) NOT NULL,
  name varchar(100),
  description varchar(500),
  website varchar(500),
  location varchar(500),
  image varchar(255),
  role varchar(50)
);

CREATE TABLE IF NOT EXISTS public.product (
  serialnumber varchar(100) PRIMARY KEY,
  name varchar(100),
  brand varchar(100)
);

COMMIT;
