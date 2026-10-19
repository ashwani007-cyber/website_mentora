import { MongoClient } from 'mongodb';

async function test() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('silver_workforce');

  const matchedWithRoleAdmin = await db.collection('admin_credentials').findOne({
    $or: [
      { email: { $in: ['kushwaahaashwani12@gmail.com', 'kushwahaashwani12@gmail.com'] } },
      { email: 'kushwaahaashwani12@gmail.com' },
      { role: 'admin' }
    ]
  });
  console.log('QUERY WITH { role: admin } MATCHED:', matchedWithRoleAdmin?.email);

  const matchedStrict = await db.collection('admin_credentials').findOne({
    $or: [
      { email: { $in: ['kushwaahaashwani12@gmail.com', 'kushwahaashwani12@gmail.com'] } },
      { email: 'kushwaahaashwani12@gmail.com' }
    ]
  });
  console.log('STRICT EMAIL QUERY MATCHED:', matchedStrict?.email);

  await client.close();
}

test();
