migrate((app) => {
  const collection = app.findCollectionByNameOrId('lab_messages');
  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.deleteRule = '@request.auth.id != ""';
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('lab_messages');
  collection.listRule = null;
  collection.viewRule = null;
  collection.deleteRule = null;
  app.save(collection);
});
