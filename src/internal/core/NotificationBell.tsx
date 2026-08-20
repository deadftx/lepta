import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, CheckCheck, ShoppingCart, MessageSquare, CheckCircle2,
  XCircle, RotateCcw, Smartphone, Laptop
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders } from '../../config/api';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showSystemNotification,
  playNotificationSound
} from './notificationService';
import './NotificationBell.css';

interface NotificationData {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  link: string;
  lida: number;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const navigate = useNavigate();

  // Verifica permissão nativa
  useEffect(() => {
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carrega notificações do backend
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notificacoes`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;

      const data = await res.json();
      const items: NotificationData[] = data.notificacoes || [];
      const totalUnread: number = data.totalNaoLidas || 0;

      // Dispara Notificação Nativa no Windows e Celular para novos itens não lidos
      if (!isFirstLoadRef.current) {
        for (const item of items) {
          if (item.lida === 0 && !seenIdsRef.current.has(item.id)) {
            // Dispara no Windows / Celular
            showSystemNotification(item.titulo, {
              body: item.mensagem,
              link: item.link,
              onClick: () => {
                if (item.link) navigate(item.link);
              }
            });
            // Efeito sonoro
            playNotificationSound();
          }
        }
      }

      // Atualiza o conjunto de IDs vistos
      items.forEach(it => seenIdsRef.current.add(it.id));
      isFirstLoadRef.current = false;

      setNotifications(items);
      setUnreadCount(totalUnread);
    } catch {
      // Falhas temporárias de rede em background não quebram o app
    }
  }, [navigate]);

  // Polling em background a cada 3.5 segundos
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchNotifications();
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Solicita permissão do navegador para Windows e Celular
  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      showSystemNotification('🔔 Notificações Ativadas!', {
        body: 'Você receberá alertas em tempo real sobre compras e mensagens.',
        link: '/administrativo/compras'
      });
    }
  };

  // Marcar única notificação como lida
  const handleItemClick = async (notif: NotificationData) => {
    if (notif.lida === 0) {
      try {
        await fetch(`${API_BASE_URL}/api/notificacoes/${notif.id}/lida`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, lida: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }

    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Marcar todas como lidas
  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/notificacoes/marcar-todas-lidas`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      setNotifications(prev => prev.map(n => ({ ...n, lida: 1 })));
      setUnreadCount(0);
    } catch {}
  };

  // Formatação de data relativa
  const formatTimeAgo = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Agora mesmo';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Há ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      return `Há ${diffDays} d`;
    } catch {
      return '';
    }
  };

  // Ícone por tipo de notificação
  const getIconForType = (tipo: string) => {
    switch (tipo) {
      case 'COMPRAS_NOVA_REQUISICAO':
        return <div className="notif-icon compra"><ShoppingCart size={16} /></div>;
      case 'COMPRAS_APROVADO':
        return <div className="notif-icon aprovado"><CheckCircle2 size={16} /></div>;
      case 'COMPRAS_NEGADO':
        return <div className="notif-icon negado"><XCircle size={16} /></div>;
      case 'COMPRAS_REABERTO':
        return <div className="notif-icon reaberto"><RotateCcw size={16} /></div>;
      case 'COMPRAS_MENSAGEM':
      default:
        return <div className="notif-icon mensagem"><MessageSquare size={16} /></div>;
    }
  };

  return (
    <div className="notif-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
        title="Notificações corporativas"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h3>
              <Bell size={16} color="#3b82f6" /> Notificações
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-read-all-btn"
                onClick={handleMarkAllRead}
              >
                <CheckCheck size={14} style={{ display: 'inline', marginRight: 4 }} />
                Marcar lidas
              </button>
            )}
          </div>

          {/* Banner para Ativar Notificações no Windows e Celular */}
          {permission !== 'granted' && isNotificationSupported() && (
            <div className="notif-permission-banner">
              <div className="notif-permission-text">
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Smartphone size={13} /> <Laptop size={13} /> Alertas no Windows e Celular
                </div>
                Receba avisos imediatos de novas compras e respostas.
              </div>
              <button
                type="button"
                className="notif-enable-btn"
                onClick={handleEnableNotifications}
              >
                Ativar
              </button>
            </div>
          )}

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                Nenhuma notificação recebida por enquanto.
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notif-item ${notif.lida === 0 ? 'unread' : ''}`}
                  onClick={() => handleItemClick(notif)}
                >
                  {getIconForType(notif.tipo)}
                  <div className="notif-body">
                    <div className="notif-title">{notif.titulo}</div>
                    <div className="notif-message">{notif.mensagem}</div>
                    <div className="notif-time">{formatTimeAgo(notif.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
