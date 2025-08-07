'use client';

import { useState, useCallback, useMemo } from 'react';
import { getInitialState, Category, DomainStatus } from '@/lib/domains';

// A new StatusIndicator component using inline styles that leverage the new CSS variables
const StatusIndicator = ({ status }: { status: DomainStatus['status'] }) => {
  const statusColor = {
    pending: 'var(--orange)', // Using CSS variables from your file
    reachable: 'var(--green)',
    blocked: 'var(--red)',
  };

  return (
    <div
      style={{
        width: '12px',
        height: '12px',
        backgroundColor: statusColor[status],
        borderRadius: '50%',
        flexShrink: 0, // Prevents the dot from shrinking
      }}
    />
  );
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

  const blockedCount = useMemo(() => {
    return Object.values(domainData).reduce(
      (acc, services) =>
        acc +
        Object.values(services).reduce(
          (serviceAcc, domains) =>
            serviceAcc + domains.filter(d => d.status === 'blocked').length,
          0
        ),
      0
    );
  }, [domainData]);

  const blockedPercentage = totalDomains > 0 ? Math.round((blockedCount / totalDomains) * 100) : 0;

  const updateDomainStatus = useCallback((category: string, service: string, domainName: string, status: DomainStatus['status']) => {
    setDomainData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const domainIndex = newData[category][service].findIndex((d: DomainStatus) => d.name === domainName);
      if (domainIndex !== -1) {
        newData[category][service][domainIndex].status = status;
      }
      return newData;
    });
    setTestedCount(prev => prev + 1);
  }, []);

  const checkDomain = async (domain: string): Promise<DomainStatus['status']> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      return 'reachable';
    } catch (error) {
      clearTimeout(timeoutId);
      return 'blocked';
    }
  };

  const handleStartTest = async () => {
    setIsTesting(true);
    setTestedCount(0);
    // Reset status to pending before starting
    setDomainData(getInitialState());

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
  };

  return (
    <main className="cnt">
      <div className="_ta-center">
        <h2>DNS Reachability Tester</h2>
        <p>
          This tool checks if your browser can reach common ad, tracking, and analytics domains. Red means blocked (good!), Green means reachable.
        </p>
        <div className="_f-center">
          <button
            onClick={handleStartTest}
            disabled={isTesting}
            className="btn btn-p"
          >
            {isTesting ? 'Testing...' : 'Start Test'}
          </button>
          {/* Using type="reset" to leverage the red styling from your CSS */}
          <button
            onClick={handleReset}
            disabled={isTesting}
            type="reset"
            className="btn"
          >
            Reset
          </button>
        </div>
        
        {(isTesting || testedCount > 0) && (
          <div style={{ marginTop: '1.5rem', width: '100%' }}>
            {/* Custom progress bar styled with CSS variables */}
            <div style={{ backgroundColor: 'var(--bg3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div
                    style={{
                        width: `${(testedCount / totalDomains) * 100}%`,
                        height: '10px',
                        backgroundColor: 'var(--primary)',
                        transition: 'width 0.3s ease-in-out',
                    }}
                />
            </div>
            <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>{testedCount} / {totalDomains} domains tested</p>
            <p>
              <strong>Blocked:</strong> {blockedCount} / {totalDomains} ({blockedPercentage}%)
            </p>
          </div>
        )}
      </div>

      <div className="grid _mt-1">
        {Object.entries(domainData).map(([categoryName, services]) => (
          <div key={categoryName} className="card">
            <h3>{categoryName}</h3>
            {Object.entries(services).map(([serviceName, domains]) => (
              <div key={serviceName}>
                <h5>{serviceName}</h5>
                {/* Default UL styling from your CSS is already flex-column */}
                <ul>
                  {domains.map((domain) => (
                    <li
                      key={domain.name}
                      // Using inline styles for flex layout of the list item
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.2rem 0'
                      }}
                    >
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
    </main>
  );
}
