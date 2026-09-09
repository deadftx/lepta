import React from 'react';
import { Briefcase, Users, Check } from 'lucide-react';
import './FloorPlanMeetingRooms.css';

interface FloorPlanMeetingRoomsProps {
  selectedRoom: 'Sala da Diretoria' | 'Sala 1' | 'TODAS' | string;
  onSelectRoom: (room: 'Sala da Diretoria' | 'Sala 1') => void;
  compact?: boolean;
  className?: string;
}

export const FloorPlanMeetingRooms: React.FC<FloorPlanMeetingRoomsProps> = ({
  selectedRoom,
  onSelectRoom,
  compact = false,
  className = ''
}) => {
  return (
    <div className={`mr-floorplan-wrapper ${compact ? 'compact' : ''} ${className}`}>
      <div className="mr-floorplan-map">
        <img
          src="/images/planta_escritorio.png"
          alt="Planta do Escritório Lepta"
          className="mr-floorplan-img"
        />

        {/* Hotspot: Sala 1 (superior/central) */}
        <button
          type="button"
          className={`mr-fp-hotspot hotspot-sala1 ${selectedRoom === 'Sala 1' ? 'selected' : ''}`}
          style={{ left: '26.7%', top: '21.9%', width: '23.7%', height: '15.3%' }}
          onClick={() => onSelectRoom('Sala 1')}
          title="Clique para selecionar a Sala 1"
          aria-label="Sala 1"
        >
          <div className="mr-fp-label">
            <Users size={13} />
            <span>Sala 1</span>
            {selectedRoom === 'Sala 1' && <Check size={12} className="mr-fp-check" />}
          </div>
          {selectedRoom === 'Sala 1' && <div className="mr-fp-pulse pulse-blue" />}
        </button>

        {/* Hotspot: Sala da Diretoria (inferior/direita) */}
        <button
          type="button"
          className={`mr-fp-hotspot hotspot-diretoria ${selectedRoom === 'Sala da Diretoria' ? 'selected' : ''}`}
          style={{ left: '69.0%', top: '64.0%', width: '26.0%', height: '17.0%' }}
          onClick={() => onSelectRoom('Sala da Diretoria')}
          title="Clique para selecionar a Sala da Diretoria"
          aria-label="Sala da Diretoria"
        >
          <div className="mr-fp-label">
            <Briefcase size={13} />
            <span>Sala da Diretoria</span>
            {selectedRoom === 'Sala da Diretoria' && <Check size={12} className="mr-fp-check" />}
          </div>
          {selectedRoom === 'Sala da Diretoria' && <div className="mr-fp-pulse pulse-purple" />}
        </button>
      </div>

      <div className="mr-floorplan-hint">
        <span>💡 Dica: Clique na sala na planta para selecioná-la</span>
      </div>
    </div>
  );
};

export default FloorPlanMeetingRooms;
