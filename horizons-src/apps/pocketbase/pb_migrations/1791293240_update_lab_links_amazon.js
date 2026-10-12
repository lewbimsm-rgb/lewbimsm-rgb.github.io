migrate((app) => {
  let col;
  try { col = app.findCollectionByNameOrId('lab_links'); } catch (_) { return; }

  // Amazon Associates affiliate links. The `tag` query parameter holds a
  // PLACEHOLDER tracking ID — the site owner must replace it with their own
  // Amazon Associates Store ID (e.g. `smartselectlabs-20`) before going live.
  const amazonLinks = [
    {
      title: 'Paddles',
      category: 'Gear',
      url: 'https://www.amazon.com/s?k=pickleball+paddle&tag=your-amazon-tag-20',
    },
    {
      title: 'Court clothing',
      category: 'Lifestyle',
      url: 'https://www.amazon.com/s?k=pickleball+court+clothing&tag=your-amazon-tag-20',
    },
    {
      title: 'Korean skincare',
      category: 'Lifestyle',
      url: 'https://www.amazon.com/s?k=korean+skincare+spf&tag=your-amazon-tag-20',
    },
  ];

  amazonLinks.forEach((item) => {
    const records = app.findRecordsByFilter('lab_links', `title = "${item.title}"`);
    if (records.length === 0) {
      const r = new Record(col);
      r.set('title', item.title);
      r.set('category', item.category);
      r.set('url', item.url);
      r.set('affiliate', true);
      app.save(r);
    } else {
      records.forEach((r) => {
        r.set('category', item.category);
        r.set('url', item.url);
        r.set('affiliate', true);
        app.save(r);
      });
    }
  });
}, (app) => {
  // Revert to the original non-affiliate retailer links.
  const original = [
    { title: 'Paddles', url: 'https://www.dickssportinggoods.com/f/pickleball-paddles' },
    { title: 'Court clothing', url: 'https://www.nike.com/w/tennis-clothing-4mksx' },
    { title: 'Korean skincare', url: 'https://www.yesstyle.com/en/beauty.html' },
  ];
  try {
    const col = app.findCollectionByNameOrId('lab_links');
    original.forEach((item) => {
      const records = app.findRecordsByFilter('lab_links', `title = "${item.title}"`);
      records.forEach((r) => {
        r.set('url', item.url);
        r.set('affiliate', false);
        app.save(r);
      });
    });
  } catch (_) { /* collection already gone */ }
});
