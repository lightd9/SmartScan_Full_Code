CREATE TABLE consumer_reports (
  id uuid PRIMARY KEY,
  serial_number text NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  request_digest text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','investigating','resolved','dismissed')),
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE consumer_report_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES consumer_reports(id),
  reviewer text NOT NULL REFERENCES auth(username),
  status text NOT NULL,
  note text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consumer_reports_status_idx ON consumer_reports(status,submitted_at);
