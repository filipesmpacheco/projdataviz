"use client";

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Upload, FileText, Filter, AlertCircle, TrendingUp, Car, Settings, Fuel, LucideIcon } from 'lucide-react';

// Cores para os gráficos (Paleta consistente)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// Cores das marcas de carros
const BRAND_COLORS: Record<string, string> = {
  'Ford': '#003478',        // Ford Blue
  'VW': '#001E50',          // Volkswagen Dark Blue
  'GM': '#2951A3',          // GM Blue
  'Fiat': '#AD0F2F',        // Fiat Red
  'Renault': '#FFCC33',     // Renault Yellow
  'Nissan': '#C3002F',      // Nissan Red
  'Chevrolet': '#2951A3',   // GM Blue (Chevrolet é GM)
  'Toyota': '#EB0A1E',      // Toyota Red
  'Honda': '#CC0000',       // Honda Red
  'Hyundai': '#002C5F',     // Hyundai Blue
};

// Cores para tipos de câmbio (Figura B - Pie Chart)
const GEAR_COLORS = {
  'automatic': '#1B4F72',   // Azul escuro
  'manual': '#2874A6',      // Azul médio
};

// Tipos
interface CardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
}

interface CarData {
  [key: string]: string | number | undefined;
  engine_size?: string | number;
  avg_price_brl?: string | number;
  year_model?: string | number;
  fuel?: string;
  brand?: string;
  gear?: string;
  month_of_reference?: string;
  year_of_reference?: string;
  engine_size_clean?: number;
  avg_price_clean?: number;
  year_model_clean?: number;
  fuel_clean?: string;
  brand_clean?: string;
}

interface BrandData {
  name: string;
  value: number;
}

interface GearData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface EvolutionData {
  name: string;
  price: number;
}

interface GroupedData {
  name: string;
  Automatico: number;
  Manual: number;
}

interface ChartsData {
  brandData: BrandData[];
  gearData: GearData[];
  evolutionData: EvolutionData[];
  groupedData: GroupedData[];
  kpis: {
    totalCars: number;
    avgPrice: number;
    mostCommonBrand: string;
  };
}

// Função para clarear uma cor hex
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + ((255 - (num >> 16)) * percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + ((255 - ((num >> 8) & 0x00FF)) * percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + ((255 - (num & 0x0000FF)) * percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const Card = ({ title, value, icon: Icon, subtext }: CardProps) => (
  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
    <div className="p-3 bg-blue-50 rounded-full">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
  </div>
);

export default function App() {
  const [data, setData] = useState<CarData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Função manual de parse de CSV para substituir a biblioteca externa
  const parseCSV = (text: string): CarData[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    // Assumindo que a primeira linha é o cabeçalho
    const headers = lines[0].split(',').map((h: string) => h.trim());
    const result: CarData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const row: CarData = {};
      let currentVal = '';
      let inQuotes = false;
      let colIndex = 0;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          if (colIndex < headers.length) {
             // Remove aspas duplas externas se existirem
             row[headers[colIndex]] = currentVal.replace(/^"|"$/g, '').trim(); 
          }
          currentVal = '';
          colIndex++;
        } else {
          currentVal += char;
        }
      }
      // Adicionar último valor da linha
      if (colIndex < headers.length) {
        row[headers[colIndex]] = currentVal.replace(/^"|"$/g, '').trim();
      }
      
      // Só adiciona se tiver lido colunas suficientes (evita linhas vazias/quebradas)
      if (Object.keys(row).length > 0) {
        result.push(row);
      }
    }
    return result;
  };

  // Função para processar o upload do CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setError("Erro ao ler o arquivo.");
          setLoading(false);
          return;
        }
        const rawData = parseCSV(text);

        // Processamento e Limpeza de Dados (Etapa 2 do Trabalho)
        const cleanedData = rawData.map(row => {
            // Tratamento engine_size: converte "1,6" para 1.6
            let engine = row.engine_size;
            if (typeof engine === 'string') {
                // Remove aspas extras que podem ter sobrado e substitui vírgula por ponto
                engine = parseFloat(engine.replace(/"/g, '').replace(',', '.'));
            }

            // Tratamento preço: remove caracteres se necessário e converte
            let price = row.avg_price_brl;
            if (typeof price === 'string') {
                price = parseFloat(price); 
            }

            // Tratamento Ano Modelo
            let yearModel = row.year_model ? parseInt(String(row.year_model)) : 0;

            // Tratamento Combustível (Padronização básica)
            let fuel = row.fuel;
            
            return {
                ...row,
                engine_size_clean: engine,
                avg_price_clean: price,
                year_model_clean: yearModel,
                fuel_clean: fuel,
                brand_clean: row.brand ? row.brand.split(' - ')[0] : 'Outros' // Pega só a sigla (GM, VW, etc)
            };
        }).filter(row => !isNaN(row.avg_price_clean || 0) && row.brand_clean); // Remove linhas inválidas

        setData(cleanedData);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Erro ao processar dados. Verifique se o arquivo é um CSV válido.");
        setLoading(false);
      }
    };

    reader.onerror = () => {
        setError("Erro ao ler o arquivo.");
        setLoading(false);
    };

    reader.readAsText(file);
  };

  // Cálculos para os Gráficos (Memoized para performance)
  const chartsData = useMemo<ChartsData | null>(() => {
    if (data.length === 0) return null;

    // 1. Distribuição por Marca (Top 10)
    const brandCount: Record<string, number> = {};
    data.forEach(d => {
      const brand = d.brand_clean;
      if (brand) {
        brandCount[brand] = (brandCount[brand] || 0) + 1;
      }
    });
    const brandData: BrandData[] = Object.entries(brandCount)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 2. Distribuição por Engrenagem (Gear)
    const gearCount: Record<string, number> = {};
    data.forEach(d => {
      const gear = d.gear || 'Desconhecido';
      gearCount[gear] = (gearCount[gear] || 0) + 1;
    });
    const gearData: GearData[] = Object.entries(gearCount).map(([name, value]) => ({ name, value: value as number }));

    // 3. Evolução Média de Preço (Por Trimestre)
    interface PriceEvolutionItem {
      total: number;
      count: number;
      sortKey: string;
      display: string;
    }
    const priceEvolution: Record<string, PriceEvolutionItem> = {};
    data.forEach(d => {
      if (!d.month_of_reference || !d.year_of_reference || !d.avg_price_clean) return;
      const monthRef = String(d.month_of_reference).toLowerCase();
      const yearRef = String(d.year_of_reference);
      
      // Determinar o trimestre baseado no mês
      let quarter = 'Q4'; // padrão
      if (['january', 'february', 'march', 'jan', 'fev', 'feb', 'mar'].some(m => monthRef.includes(m))) {
        quarter = 'Q1';
      } else if (['april', 'may', 'june', 'abr', 'apr', 'mai', 'jun'].some(m => monthRef.includes(m))) {
        quarter = 'Q2';
      } else if (['july', 'august', 'september', 'jul', 'ago', 'aug', 'set', 'sep'].some(m => monthRef.includes(m))) {
        quarter = 'Q3';
      } else if (['october', 'november', 'december', 'out', 'oct', 'nov', 'dez', 'dec'].some(m => monthRef.includes(m))) {
        quarter = 'Q4';
      }
      
      const key = `${quarter}/${yearRef}`; // Ex: Q1/2021, Q2/2021
      const sortKey = `${yearRef}-${quarter}`; // Para ordenação
      
      if (!priceEvolution[key]) priceEvolution[key] = { total: 0, count: 0, sortKey, display: key };
      priceEvolution[key].total += d.avg_price_clean;
      priceEvolution[key].count += 1;
    });
    
    // Ordenação cronológica para visualização
    const evolutionData: EvolutionData[] = Object.values(priceEvolution)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey)) // Ordena por data cronologicamente
      .map(item => ({ name: item.display, price: Math.round(item.total / item.count) }));

    // 4. Média de Preço por Marca e Engrenagem (Extra 1)
    // Top 6 marcas e dividindo por gear (para incluir mais marcas como Nissan)
    const top5Brands = brandData.slice(0,6).map(b => b.name);
    interface GroupedDataItem {
      name: string;
      automatic: number;
      manual: number;
      countAuto: number;
      countManual: number;
    }
    const groupedDataObj: Record<string, GroupedDataItem> = {};
    
    data.filter(d => top5Brands.includes(d.brand_clean || '')).forEach(d => {
        const brand = d.brand_clean || '';
        if (!groupedDataObj[brand]) groupedDataObj[brand] = { name: brand, automatic: 0, manual: 0, countAuto: 0, countManual: 0 };
        if (d.gear === 'automatic' && d.avg_price_clean) {
            groupedDataObj[brand].automatic += d.avg_price_clean;
            groupedDataObj[brand].countAuto += 1;
        } else if (d.gear === 'manual' && d.avg_price_clean) {
            groupedDataObj[brand].manual += d.avg_price_clean;
            groupedDataObj[brand].countManual += 1;
        }
    });

    const groupedData: GroupedData[] = Object.values(groupedDataObj).map(item => ({
        name: item.name,
        Automatico: item.countAuto ? Math.round(item.automatic / item.countAuto) : 0,
        Manual: item.countManual ? Math.round(item.manual / item.countManual) : 0
    }));


    // KPIs
    const totalCars = data.length;
    const avgPrice = totalCars > 0 ? data.reduce((acc, curr) => acc + (curr.avg_price_clean || 0), 0) / totalCars : 0;
    const mostCommonBrand = brandData.length > 0 ? brandData[0].name : '-';

    return { brandData, gearData, evolutionData, groupedData, kpis: { totalCars, avgPrice, mostCommonBrand } };
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Dashboard Analítico - DataViz</h1>
              <p className="text-blue-200 mt-1">Análise de Preços de Carros no Brasil</p>
            </div>
            <div className="text-right text-sm text-blue-300">
              <p>Projeto Final</p>
              <p>Ferramenta: React + Recharts</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Upload Section */}
        {!data.length && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors">
            <div className="max-w-md mx-auto">
              <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Carregue seu Dataset</h2>
              <p className="text-gray-500 mb-6">Faça o upload do arquivo .csv fornecido para gerar as visualizações automaticamente.</p>
              
              <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer transition-colors">
                Selecionar Arquivo CSV
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              
              {loading && <p className="mt-4 text-blue-600 animate-pulse">Processando dados...</p>}
              {error && <p className="mt-4 text-red-500 flex items-center justify-center gap-2"><AlertCircle size={16}/> {error}</p>}
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {chartsData && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Control Bar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText size={16} />
                    Arquivo: <span className="font-semibold">{fileName}</span>
                </div>
                <button onClick={() => setData([])} className="text-red-500 text-sm hover:underline">Remover arquivo</button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card 
                title="Total de Registros" 
                value={chartsData.kpis.totalCars.toLocaleString('pt-BR')} 
                icon={Car} 
                subtext="Linhas processadas"
              />
              <Card 
                title="Preço Médio Global" 
                value={`R$ ${chartsData.kpis.avgPrice.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} 
                icon={TrendingUp} 
                subtext="Média de todas as categorias"
              />
              <Card 
                title="Marca Mais Frequente" 
                value={chartsData.kpis.mostCommonBrand} 
                icon={Settings} 
                subtext="Maior volume de dados"
              />
            </div>

            {/* Row 1: Distributions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart A: Cars by Brand */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">FIG A</span>
                    Distribuição de Carros por Marca (Top 10)
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartsData.brandData} layout="vertical" margin={{ left: 40, right: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                      <RechartsTooltip formatter={(value: number) => [value, 'Quantidade']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#374151' }}>
                        {chartsData.brandData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={BRAND_COLORS[entry.name] || '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2">Marcas com maior frequência na base de dados.</p>
              </div>

              {/* Chart B: Cars by Gear */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">FIG B</span>
                    Distribuição por Tipo de Engrenagem
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartsData.gearData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent, value }: { name?: string; percent?: number; value?: number }) => 
                          `${name || ''} ${((percent || 0) * 100).toFixed(0)}% (${value || 0})`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartsData.gearData.map((entry, index) => {
                          const gearType = entry.name.toLowerCase();
                          const color = gearType === 'automatic' ? GEAR_COLORS.automatic : 
                                        gearType === 'manual' ? GEAR_COLORS.manual : 
                                        COLORS[index % COLORS.length];
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2">Comparativo entre Câmbio Manual e Automático.</p>
              </div>
            </div>

            {/* Row 2: Price Evolution */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">FIG C</span>
                    Evolução Média de Preço por Trimestre
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartsData.evolutionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        domain={[40000, 60000]}
                        ticks={[40000, 45000, 50000, 55000, 60000]}
                        tickFormatter={(val: number) => `R$${val/1000}k`} 
                      />
                      <RechartsTooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Preço Médio']} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#ff7300" 
                        strokeWidth={3} 
                        activeDot={{ r: 8 }} 
                        name="Preço Médio"
                        label={{ position: 'top', fontSize: 11, fill: '#ff7300', formatter: (value: any) => `R$${(Number(value)/1000).toFixed(0)}k` }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2">Dados agrupados por trimestre (Q1: Jan-Mar, Q2: Abr-Jun, Q3: Jul-Set, Q4: Out-Dez) para análise temporal detalhada.</p>
            </div>

            {/* Row 3: Extra Analysis */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">FIG D (EXTRA)</span>
                    Preço Médio por Marca e Tipo de Câmbio (Top 6)
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartsData.groupedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(val: number) => `R$${val/1000}k`} />
                      <RechartsTooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Preço Médio']} />
                      <Legend />
                      <Bar 
                        dataKey="Manual" 
                        name="Manual (Esquerda)"
                        label={{ position: 'top', fontSize: 10, formatter: (value: any) => Number(value) > 0 ? `R$${(Number(value)/1000).toFixed(0)}k` : '' }}
                      >
                        {chartsData.groupedData.map((entry, index) => {
                          const baseColor = BRAND_COLORS[entry.name] || '#82ca9d';
                          return <Cell key={`manual-${index}`} fill={lightenColor(baseColor, 30)} />;
                        })}
                      </Bar>
                      <Bar 
                        dataKey="Automatico" 
                        name="Automático (Direita)"
                        label={{ position: 'top', fontSize: 10, formatter: (value: any) => Number(value) > 0 ? `R$${(Number(value)/1000).toFixed(0)}k` : '' }}
                      >
                        {chartsData.groupedData.map((entry, index) => {
                          const baseColor = BRAND_COLORS[entry.name] || '#8884d8';
                          return <Cell key={`auto-${index}`} fill={baseColor} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2">Análise cruzada para identificar impacto do câmbio no valor por marca.</p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
