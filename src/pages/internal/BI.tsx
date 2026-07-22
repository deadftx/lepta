import React, { useEffect, useState } from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PieChart, TrendingUp, Activity } from 'lucide-react';
import './Operations.css';

const COLORS = ['#00cc66', '#ff9900', '#ff3366', '#3399ff', '#8884d8'];

const BI = () => {
  const [creditData, setCreditData] = useState<any[]>([]);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:3004/credits').then(res => res.json()),
      fetch('http://localhost:3004/risks').then(res => res.json())
    ]).then(([credits, risks]) => {
      // Process Credit Data for Charts
      const statusCount = credits.reduce((acc: any, curr: any) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});
      
      const chartDataStatus = Object.keys(statusCount).map(key => ({
        name: key,
        value: statusCount[key]
      }));

      setCreditData(chartDataStatus);

      // Process Risk Data
      const ratingCount = risks.reduce((acc: any, curr: any) => {
        const baseRating = curr.rating.charAt(0); // A, B, C
        acc[baseRating] = (acc[baseRating] || 0) + 1;
        return acc;
      }, {});

      const chartDataRisk = Object.keys(ratingCount).map(key => ({
        name: `Rating ${key}`,
        Quantidade: ratingCount[key]
      }));

      setRiskData(chartDataRisk);
      setLoading(false);
    });
  }, []);

  return (
    <div className="operations-page">
      <div className="page-header">
        <div>
          <h2>Business Intelligence</h2>
          <p>Visão gerencial consolidada das operações e carteira.</p>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass">
          <div className="icon-wrapper bg-blue"><TrendingUp size={24} /></div>
          <div className="summary-info">
            <span className="label">Crescimento Carteira</span>
            <h4>+12.5%</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-green"><Activity size={24} /></div>
          <div className="summary-info">
            <span className="label">Saúde da Carteira</span>
            <h4>88% (Bom)</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-orange"><PieChart size={24} /></div>
          <div className="summary-info">
            <span className="label">Meta de Originação</span>
            <h4>65% Atingido</h4>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        <div className="internal-card glass">
          <h3>Distribuição de Status (Crédito)</h3>
          <div style={{ width: '100%', height: 300, marginTop: '1rem' }}>
            {loading ? <p>Carregando...</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={creditData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {creditData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1e1e', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="internal-card glass">
          <h3>Concentração de Risco (Rating)</h3>
          <div style={{ width: '100%', height: 300, marginTop: '1rem' }}>
            {loading ? <p>Carregando...</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ background: '#1e1e1e', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="Quantidade" fill="#3399ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BI;
