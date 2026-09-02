import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  Sparkles, 
  CornerDownLeft, 
  Home, 
  Calendar, 
  Wallet, 
  FileSpreadsheet, 
  Landmark, 
  DollarSign, 
  BrainCircuit, 
  Users, 
  ContactRound, 
  ShieldCheck, 
  TrendingUp, 
  ClipboardCheck, 
  UserCheck, 
  Briefcase, 
  ShoppingCart, 
  SlidersHorizontal, 
  CalendarCheck, 
  Database, 
  LayoutDashboard, 
  Sliders, 
  Shield, 
  UserPlus, 
  Mail, 
  ShieldAlert, 
  Clock, 
  HelpCircle, 
  Network
} from 'lucide-react';
import { systemSearchItems, type SearchItem } from './search/systemSearchData';
import { hasPermission } from './permissions';
import { useAuth } from './AuthContext';
import './SystemSearchModal.css';

interface SystemSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon mapper helper
const renderIcon = (iconName: string, size = 18) => {
  switch (iconName) {
    case 'Home': return <Home size={size} />;
    case 'Calendar': return <Calendar size={size} />;
    case 'Wallet': return <Wallet size={size} />;
    case 'FileSpreadsheet': return <FileSpreadsheet size={size} />;
    case 'Landmark': return <Landmark size={size} />;
    case 'DollarSign': return <DollarSign size={size} />;
    case 'BrainCircuit': return <BrainCircuit size={size} />;
    case 'Users': return <Users size={size} />;
    case 'ContactRound': return <ContactRound size={size} />;
    case 'ShieldCheck': return <ShieldCheck size={size} />;
    case 'TrendingUp': return <TrendingUp size={size} />;
    case 'ClipboardCheck': return <ClipboardCheck size={size} />;
    case 'UserCheck': return <UserCheck size={size} />;
    case 'Briefcase': return <Briefcase size={size} />;
    case 'ShoppingCart': return <ShoppingCart size={size} />;
    case 'SlidersHorizontal': return <SlidersHorizontal size={size} />;
    case 'CalendarCheck': return <CalendarCheck size={size} />;
    case 'Database': return <Database size={size} />;
    case 'LayoutDashboard': return <LayoutDashboard size={size} />;
    case 'Sliders': return <Sliders size={size} />;
    case 'Shield': return <Shield size={size} />;
    case 'UserPlus': return <UserPlus size={size} />;
    case 'Mail': return <Mail size={size} />;
    case 'ShieldAlert': return <ShieldAlert size={size} />;
    case 'Clock': return <Clock size={size} />;
    case 'HelpCircle': return <HelpCircle size={size} />;
    case 'Network': return <Network size={size} />;
    default: return <Search size={size} />;
  }
};

// Normalize text for search comparison (strips accents and converts to lowercase)
const normalize = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const SystemSearchModal: React.FC<SystemSearchModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on user permissions
  const accessibleItems = useMemo(() => {
    return systemSearchItems.filter(item => {
      if (item.masterOnly && user?.role !== 'MASTER') return false;
      if (item.permissionId && !hasPermission(user, item.permissionId)) return false;
      return true;
    });
  }, [user]);

  // Search & score matching items
  const searchResults = useMemo(() => {
    const rawQuery = normalize(query);
    if (!rawQuery) {
      // Default suggested items when query is empty
      return accessibleItems.slice(0, 7);
    }

    const queryTerms = rawQuery.split(/\s+/).filter(Boolean);

    const scored = accessibleItems
      .map(item => {
        const titleNorm = normalize(item.title);
        const descNorm = normalize(item.description);
        const explNorm = normalize(item.explanation || '');
        const catNorm = normalize(item.category);
        const breadcrumbNorm = normalize(item.breadcrumb.join(' '));
        const keywordsNorm = item.keywords.map(normalize);

        let score = 0;

        // Check each term
        queryTerms.forEach(term => {
          // Exact keyword match
          if (keywordsNorm.some(k => k === term)) {
            score += 100;
          } else if (keywordsNorm.some(k => k.includes(term))) {
            score += 50;
          }

          // Title match
          if (titleNorm === term) {
            score += 90;
          } else if (titleNorm.startsWith(term)) {
            score += 70;
          } else if (titleNorm.includes(term)) {
            score += 40;
          }

          // Category or Breadcrumb match
          if (catNorm.includes(term) || breadcrumbNorm.includes(term)) {
            score += 30;
          }

          // Explanation / Description match
          if (explNorm.includes(term)) {
            score += 25;
          } else if (descNorm.includes(term)) {
            score += 15;
          }
        });

        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);

    return scored;
  }, [query, accessibleItems]);

  // Reset selection index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, searchResults.length]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`.search-result-item[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectItem(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleSelectItem = (item: SearchItem) => {
    onClose();
    navigate(item.path);
  };

  if (!isOpen) return null;

  return (
    <div className="system-search-overlay" onClick={onClose}>
      <div 
        className="system-search-dialog" 
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="system-search-header">
          <div className="system-search-icon-box">
            <Search size={20} className="system-search-main-icon" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="system-search-input"
            placeholder="O que você precisa encontrar no sistema? (ex: Sacados, Extrato, Risco, Comitê...)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button 
              className="system-search-clear-btn" 
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              title="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
          <div className="system-search-esc-badge" onClick={onClose} title="Pressione ESC para fechar">
            ESC
          </div>
        </div>

        {/* Results List */}
        <div className="system-search-results" ref={listRef}>
          {searchResults.length > 0 ? (
            <>
              <div className="system-search-section-title">
                {query ? (
                  <span>
                    <Sparkles size={14} className="sparkle-icon" /> Resultados encontrados ({searchResults.length})
                  </span>
                ) : (
                  <span>
                    <Sparkles size={14} className="sparkle-icon" /> Sugestões de acesso rápido para você
                  </span>
                )}
              </div>

              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    className={`search-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="result-item-icon">
                      {renderIcon(item.icon, 20)}
                    </div>

                    <div className="result-item-content">
                      <div className="result-item-top">
                        <div className="result-item-breadcrumb">
                          {item.breadcrumb.map((crumb, cIdx) => (
                            <React.Fragment key={cIdx}>
                              <span className="breadcrumb-chip">{crumb}</span>
                              {cIdx < item.breadcrumb.length - 1 && <span className="breadcrumb-arrow">›</span>}
                            </React.Fragment>
                          ))}
                        </div>
                        {item.badge && (
                          <span className={`result-item-badge ${item.badge.toLowerCase()}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="result-item-title">{item.title}</h4>
                      <p className="result-item-desc">{item.description}</p>

                      {item.explanation && (
                        <div className="result-item-explanation">
                          <span className="explanation-indicator">🧭 Onde acessar:</span>
                          <span className="explanation-text">{item.explanation}</span>
                        </div>
                      )}
                    </div>

                    <div className="result-item-action">
                      <span className="action-hint">Acessar</span>
                      <CornerDownLeft size={16} className="enter-icon" />
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="system-search-empty">
              <div className="empty-icon-circle">
                <Search size={32} />
              </div>
              <h3>Nenhum resultado encontrado para &quot;{query}&quot;</h3>
              <p>Verifique a ortografia ou tente pesquisar por termos como <strong>sacados</strong>, <strong>extratos</strong>, <strong>reembolso</strong>, <strong>comitê</strong>, <strong>risco</strong> ou <strong>cobrança</strong>.</p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="system-search-footer">
          <div className="search-shortcut-group">
            <span className="shortcut-key">↑</span>
            <span className="shortcut-key">↓</span>
            <span className="shortcut-label">Navegar</span>
          </div>
          <div className="search-shortcut-group">
            <span className="shortcut-key">↵ Enter</span>
            <span className="shortcut-label">Acessar</span>
          </div>
          <div className="search-shortcut-group">
            <span className="shortcut-key">ESC</span>
            <span className="shortcut-label">Fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SystemSearchModal;
