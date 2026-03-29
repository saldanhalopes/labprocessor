import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyA5q2GiivhtBzud9Ezrm4rTLEk33J50zQ0",
  authDomain: "labprocessor-ec44b.firebaseapp.com",
  projectId: "labprocessor-ec44b",
  storageBucket: "labprocessor-ec44b.firebasestorage.app",
  messagingSenderId: "758778354969",
  appId: "1:758778354969:web:7608c2457f145170a3f988",
  measurementId: "G-8E6SRPZSZ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export default app;
