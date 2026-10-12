migrate((app) => {
  let records;
  try {
    records = app.findRecordsByFilter('lab_links', 'title = "Paddles"');
  } catch (_) {
    return;
  }

  records.forEach((record) => {
    record.set('url', 'https://link.amazon/B03h1URWv');
    record.set('affiliate', true);
    app.save(record);
  });
}, (app) => {
  const records = app.findRecordsByFilter('lab_links', 'title = "Paddles"');
  records.forEach((record) => {
    record.set('url', 'https://www.amazon.com/s?k=pickleball+paddle&tag=your-amazon-tag-20');
    record.set('affiliate', true);
    app.save(record);
  });
});
