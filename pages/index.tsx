import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Load environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const isBrowser = typeof window !== 'undefined';
const TwilioClient = isBrowser ? require('twilio-client') : null;

// Initialize socket connection
const socket = io(API_BASE_URL);

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [objection, setObjection] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [device, setDevice] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);

  // Setup Twilio Device on Mount
  useEffect(() => {
    if (!isBrowser || !TwilioClient) return;

    async function setupTwilio() {
      try {
        const response = await fetch(`${API_BASE_URL}/token`);
        const data = await response.json();

        const twilioDevice = new TwilioClient.Device(data.token, { debug: true });

        twilioDevice.on('ready', () => console.log('Twilio Device Ready'));
        twilioDevice.on('error', (err: any) => console.error('Twilio Error:', err));
        twilioDevice.on('connect', (conn: any) => {
          console.log('Call Connected', conn);
          setCallStatus('Connected');
        });
        twilioDevice.on('disconnect', () => {
          console.log('Call Disconnected');
          setCallStatus('Call Ended');
        });

        setDevice(twilioDevice);
      } catch (error) {
        console.error('Twilio Setup Error:', error);
      }
    }

    setupTwilio();
  }, []);

  //Listen for AI Suggestion from Backend
  useEffect(() => {
    socket.on('suggestion', (suggestion: string) => {
      console.log(`Received AI Suggestion: ${suggestion}`);
      setSuggestion(suggestion); //Update UI when backend responds
    });

    return () => {
      socket.off('suggestion');
    };
  }, []);

  //Handle Dialing
  const handleDial = async () => {
    if (device && phoneNumber) {
      console.log(` Calling ${phoneNumber} from WebRTC ...`);

      // Ensure the `params` object is a plain object
      const params = {
        To: phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber.replace(/\D/g, '')}`
      };

      console.log("Params being sent:", params);

      const conn = device.connect({ params });

      setConnection(conn);
      setCallStatus(`Dialing ${phoneNumber}...`);
    } else {
      console.error('Twilio Device not initialized or phone number missing');
      setCallStatus('Twilio Device not ready');
    }
  };

  //  Handle Hanging Up
  const handleHangUp = () => {
    if (connection) {
      connection.disconnect();
      setCallStatus('Call Ended');
    }
  };

  // Handle Objection Submission
  const handleObjection = () => {
    if (objection.trim() !== '') {
      console.log(`Sending objection to backend: ${objection}`);
      socket.emit('objection', objection); // Send objection to backend
    } else {
      console.warn('Objection input is empty');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Sales Dialer Tool</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <input
          type="text"
          placeholder="Enter phone number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="border p-2 rounded w-full mb-4"
        />
        <button onClick={handleDial} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Dial
        </button>
        <button onClick={handleHangUp} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ml-2">
          Hang Up
        </button>
        <p className="mt-4 text-gray-700">{callStatus}</p>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Objection Handling</h2>
          <input
            type="text"
            placeholder="Enter objection"
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            className="border p-2 rounded w-full mb-4"
          />
          <button
            onClick={handleObjection} // Ensure button triggers the function
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Get Suggestion
          </button>
          {suggestion && (
            <div className="mt-4 p-4 bg-yellow-50 rounded">
              <p className="text-yellow-800">{suggestion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
