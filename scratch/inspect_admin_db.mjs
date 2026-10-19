import { MongoClient } from 'mongodb';

async function inspect() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('silver_workforce');
  
  const adminCreds = await db.collection('admin_credentials').find({}).toArray();
  const adminUsers = await db.collection('users').find({ role: 'admin' }).toArray();
  const allAshwaniUsers = await db.collection('users').find({ 
    email: { $regex: 'ashwani', $options: 'i' } 
  }).toArray();
  
  console.log('=== ADMIN_CREDENTIALS ===');
  console.log(JSON.stringify(adminCreds, null, 2));

  console.log('=== ADMIN USERS ===');
  console.log(JSON.stringify(adminUsers, null, 2));

  console.log('=== ALL ASHWANI USERS ===');
  console.log(JSON.stringify(allAshwaniUsers, null, 2));

  await client.close();
}

inspect().catch(console.error);
