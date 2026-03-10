'use client';

import { useState } from 'react';

interface NDAModalProps {
  onAccept: () => void;
}

export default function NDAModal({ onAccept }: NDAModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/nda-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });

      if (response.ok) {
        onAccept();
      }
    } catch (error) {
      console.error('Failed to accept NDA:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Non-Disclosure Agreement
          </h2>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-gray-700 dark:text-gray-300">
          <p className="text-sm">
            <strong>Effective Date:</strong> March 10, 2026
          </p>

          <p>
            This Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into between{' '}
            <strong>Orion Solana LLC dba ZeroG Trading</strong> (&quot;Company&quot;) and you (&quot;User&quot;).
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">
            1. Confidential Information
          </h3>
          <p>
            You acknowledge that access to Meridian dashboard, trading strategies, signals, 
            algorithms, performance data, and proprietary methods constitutes confidential 
            and proprietary information of the Company.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">
            2. Obligations
          </h3>
          <p>
            You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Keep all trading strategies, signals, and performance data confidential</li>
            <li>Not share, reproduce, or distribute any proprietary information</li>
            <li>Not reverse-engineer or attempt to replicate the Company&apos;s trading systems</li>
            <li>Use the information solely for your own trading purposes</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">
            3. Duration
          </h3>
          <p>
            This Agreement remains in effect for the duration of your access to the platform 
            and for 2 years following termination of access.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">
            4. Governing Law
          </h3>
          <p>
            This Agreement is governed by the laws of the State of California, United States.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">
            5. Acknowledgment
          </h3>
          <p>
            By clicking &quot;I Accept,&quot; you acknowledge that you have read, understood, and agree 
            to be bound by this Non-Disclosure Agreement with{' '}
            <strong>Orion Solana LLC dba ZeroG Trading</strong>.
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I have read and agree to the Non-Disclosure Agreement with{' '}
              <strong>Orion Solana LLC dba ZeroG Trading</strong>
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              accepted && !loading
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processing...' : 'I Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
