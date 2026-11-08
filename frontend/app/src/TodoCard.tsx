import {
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "../../../shared/board.ts";
import type { Status, Todo } from "../../../shared/board.ts";

interface Props {
  todo: Todo;
  pending: boolean;
  onEdit: (todo: Todo) => void;
  onStatusChange: (todo: Todo, status: Status) => Promise<void>;
  onDelete: (todo: Todo) => Promise<void>;
}

export function TodoCard({
  todo,
  pending,
  onEdit,
  onStatusChange,
  onDelete,
}: Props) {
  return (
    <article className={`todo-card ${todo.status === "done" ? "is-done" : ""}`}>
      <div className="card-meta">
        <span className="theme-label">{todo.theme}</span>
        <span className={`priority-label priority-${todo.priority}`}>
          <span aria-hidden="true">●</span> 優先度：
          {PRIORITY_LABELS[todo.priority]}
        </span>
      </div>
      <h3>{todo.title}</h3>
      {todo.description && (
        <p className="todo-description">{todo.description}</p>
      )}
      <div className="card-footer">
        <div className={`status-control status-${todo.status}`}>
          <label className="sr-only" htmlFor={`status-${todo.id}`}>
            「{todo.title}」のステータス
          </label>
          <select
            id={`status-${todo.id}`}
            value={todo.status}
            disabled={pending}
            onChange={(event) =>
              void onStatusChange(todo, event.target.value as Status)
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="card-actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => onEdit(todo)}
            aria-label={`「${todo.title}」を編集`}
          >
            編集
          </button>
          <button
            type="button"
            className="delete-button"
            disabled={pending}
            aria-label={`「${todo.title}」を削除`}
            onClick={() => void onDelete(todo)}
          >
            削除
          </button>
        </div>
      </div>
    </article>
  );
}
