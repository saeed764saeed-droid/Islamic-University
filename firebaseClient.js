import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// د میراث اسلام Firebase Web App تنظیمات
export const firebaseConfig = {
  apiKey: 'AIzaSyCnDgT-EcgxAE6GzaebJXcVEU13NYy9UkQ',
  authDomain: 'islamic-university-27d8f.firebaseapp.com',
  projectId: 'islamic-university-27d8f',
  storageBucket: 'islamic-university-27d8f.firebasestorage.app',
  messagingSenderId: '625248472412',
  appId: '1:625248472412:web:d65649a554150a19ab4599',
  measurementId: 'G-Q5801XHZ3E'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let firebaseAuth;
try {
  firebaseAuth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // که Auth مخکې initialize شوی وي، هماغه instance وکاروه.
  firebaseAuth = getAuth(firebaseApp);
}

export const auth = firebaseAuth;
export const db = getFirestore(firebaseApp);
