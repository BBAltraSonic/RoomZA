update storage.buckets
set allowed_mime_types = array[
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/json',
  'application/xml',
  'text/xml',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'listing-imports';
