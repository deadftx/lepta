import { ChevronDown } from 'lucide-react';
import { permissionGroups } from './permissions';

interface PermissionSelectorProps {
  selected: string[];
  onToggle: (permissionId: string) => void;
}

const PermissionSelector = ({ selected, onToggle }: PermissionSelectorProps) => (
  <div className="permissions-list permission-tree">
    {permissionGroups.map(group => group.children ? (
      <details className="permission-group" key={group.id}>
        <summary>
          <span>{group.name}</span>
          <ChevronDown size={18} />
        </summary>
        <div className="permission-children">
          {group.children.map(child => (
            <label key={child.id} className="permission-item">
              <input
                type="checkbox"
                checked={selected.includes(child.id)}
                onChange={() => onToggle(child.id)}
              />
              <span>{child.name}</span>
            </label>
          ))}
        </div>
      </details>
    ) : (
      <label key={group.id} className="permission-item">
        <input
          type="checkbox"
          checked={selected.includes(group.id)}
          onChange={() => onToggle(group.id)}
        />
        <span>{group.name}</span>
      </label>
    ))}
  </div>
);

export default PermissionSelector;
