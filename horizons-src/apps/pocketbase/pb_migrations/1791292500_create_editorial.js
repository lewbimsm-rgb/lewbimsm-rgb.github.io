migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.createRule = null;
  app.save(users);
  const names = ['lab_posts', 'lab_links', 'lab_messages'];
  const schemas = [
    [{name:'title',type:'text',required:true,max:180},{name:'slug',type:'text',required:true,max:180,pattern:'^[a-z0-9]+(-[a-z0-9]+)*$'},{name:'excerpt',type:'text',required:true,max:320},{name:'category',type:'select',values:['Beginner','Intermediate','Advanced','Gear','Lifestyle'],required:true,maxSelect:1},{name:'image',type:'url'},{name:'published',type:'date'},{name:'live',type:'bool'},{name:'sections',type:'json',required:true,maxSize:200000}],
    [{name:'title',type:'text',required:true,max:180},{name:'category',type:'text',required:true,max:100},{name:'url',type:'url',required:true},{name:'affiliate',type:'bool'}],
    [{name:'name',type:'text',required:true,max:120},{name:'email',type:'email',required:true},{name:'message',type:'text',required:true,min:10,max:5000}]
  ];
  names.forEach((name,i) => {
    let col;
    try { col = app.findCollectionByNameOrId(name); } catch (_) {
      col = new Collection({name,type:'base',listRule:i===0?'live = true || @request.auth.id != ""':i===1?'':null,viewRule:i===0?'live = true || @request.auth.id != ""':i===1?'':null,createRule:i===2?'':'@request.auth.id != ""',updateRule:i===2?null:'@request.auth.id != ""',deleteRule:i===2?null:'@request.auth.id != ""',fields:schemas[i].concat([{name:'created',type:'autodate',onCreate:true,onUpdate:false},{name:'updated',type:'autodate',onCreate:true,onUpdate:true}]),indexes:i===0?['CREATE UNIQUE INDEX idx_lab_posts_slug ON lab_posts (slug)']:[]});
      app.save(col);
    }
    if (i===1 && app.countRecords(col)===0) {
      [['Paddles','Gear','https://www.dickssportinggoods.com/f/pickleball-paddles'],['Court clothing','Lifestyle','https://www.nike.com/w/tennis-clothing-4mksx'],['Korean skincare','Lifestyle','https://www.yesstyle.com/en/beauty.html']].forEach((item)=>{const r=new Record(col);r.set('title',item[0]);r.set('category',item[1]);r.set('url',item[2]);r.set('affiliate',false);app.save(r);});
    }
  });
},(app)=>{['lab_messages','lab_links','lab_posts'].forEach((name)=>{try {app.delete(app.findCollectionByNameOrId(name));} catch (_) {}});});
