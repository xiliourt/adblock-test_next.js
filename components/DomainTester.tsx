'use client';

import { useState, useCallback } from 'react';
import { getInitialState, Category, DomainStatus } from '@/lib/domains';

// A small component to display the status indicator dot
const StatusIndicator = ({ status }: { status: DomainStatus['status'] }) => {
  const baseClasses = 'w-3 h-3 rounded-full mr-3';
  const statusClasses = {
    pending: 'bg-gray-400 animate-pulse',
    reachable: 'bg-green-500',
    blocked: 'bg-red-500',
  };
  return <div className={`${baseClasses} ${statusClasses[status]}`} />;
};

export default function DomainTester() {
  const [domainData, setDomainData] = useState<Category>(getInitialState);
  const [isTesting, setIsTesting] = useState(false);
  const [testedCount, setTestedCount] = useState(0);

  const totalDomains = Object.values(domainData).reduce(
    (acc, services) =>
      acc +
      Object.values(services).reduce(
        (serviceAcc, domains) => serviceAcc + domains.length,
        0
      ),
    0
  );

  const updateDomainStatus = useCallback((category: string, service: string, domainName: string, status: DomainStatus['status']) => {
    setDomainData(prevData => {
      // Deep copy to avoid mutation
      const newData = JSON.parse(JSON.stringify(prevData));
      const domainIndex = newData[category][service].findIndex((d: DomainStatus) => d.name === domainName);
      if (domainIndex !== -1) {
        newData[category][service][domainIndex].status = status;
      }
      return newData;
    });
    setTestedCount(prev => prev + 1);
  }, []);

  // The core function to test a single domain
  const checkDomain = async (domain: string): Promise<DomainStatus['status']> => {
    // We use a HEAD request with 'no-cors' mode.
    // 'no-cors' prevents CORS errors from blocking the request.
    // The browser can still tell us if the network request failed (e.g., DNS error),
    // which is exactly what we want to know.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
      await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store', // Ensure a fresh request every time
      });
      clearTimeout(timeoutId);
      return 'reachable';
    } catch (error) {
      clearTimeout(timeoutId);
      // Any error (timeout, DNS resolution failure, network error) is considered "blocked"
      return 'blocked';
    }
  };

  const handleStartTest = async () => {
    setIsTesting(true);
    setTestedCount(0);

    const allTestPromises = [];

    for (const categoryName in domainData) {
      for (const serviceName in domainData[categoryName]) {
        for (const domain of domainData[categoryName][serviceName]) {
          const promise = checkDomain(domain.name).then(status => {
            updateDomainStatus(categoryName, serviceName, domain.name, status);
          });
          allTestPromises.push(promise);
        }
      }
    }
    await Promise.all(allTestPromises);
    setIsTesting(false);
  };
  
  const handleReset = () => {
    setDomainData(getInitialState());
    setTestedCount(0);
    setIsTesting(false);
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">DNS Reachability Tester</h1>
        <p className="text-gray-600 dark:text-gray-300">
          This tool checks if your browser can reach common ad, tracking, and analytics domains. Red means blocked (good!), Green means reachable.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStartTest}
              disabled={isTesting}
              className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isTesting ? 'Testing...' : 'Start Test'}
            </button>
             <button
              onClick={handleReset}
              disabled={isTesting}
              className="px-6 py-3 font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
            >
              Reset
            </button>
        </div>
        { (isTesting || testedCount > 0) && (
            <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(testedCount/totalDomains) * 100}%` }}></div>
                </div>
                <p className="text-sm text-center mt-2 text-gray-600 dark:text-gray-400">{testedCount} / {totalDomains} domains tested</p>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(domainData).map(([categoryName, services]) => (
          <div key={categoryName} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 text-gray-800 dark:text-white">{categoryName}</h2>
            {Object.entries(services).map(([serviceName, domains]) => (
              <div key={serviceName} className="mb-4 last:mb-0">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{serviceName}</h3>
                <ul>
                  {domains.map((domain) => (
                    <li key={domain.name} className="flex items-center text-sm py-1 text-gray-600 dark:text-gray-400">
                      <StatusIndicator status={domain.status} />
                      <span>{domain.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
