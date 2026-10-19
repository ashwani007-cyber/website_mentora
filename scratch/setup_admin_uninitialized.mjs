import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('silver_workforce');
  const nowIso = new Date().toISOString();
  
  await db.collection('admin_credentials').updateOne(
    { email: 'kushwahaashwani12@gmail.com' },
    { 
      $set: { 
        initialized: false, 
        password: null, 
        currentToken: null, 
        updatedAt: nowIso 
      } 
    },
    { upsert: true }
  );

  await db.collection('users').updateOne(
    { email: 'kushwahaashwani12@gmail.com' },
    { 
      $set: { 
        password: null, 
        isPasswordInitialized: false, 
        updatedAt: nowIso 
      } 
    },
    { upsert: true }
  );

  console.log('Successfully set kushwahaashwani12@gmail.com to uninitialized state in MongoDB!');
  await client.close();
}

run().catch(console.error);
