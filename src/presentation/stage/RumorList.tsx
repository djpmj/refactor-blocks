import type { Stage } from '../../domain/stage/Stage';
import { rumoredRequests } from '../../domain/change/rumors';
import { useGameStore } from '../store/useGameStore';

export function RumorList({ stage }: Readonly<{ stage: Stage }>) {
  const enabled = useGameStore((state) => state.storyEnabled);
  const requests = rumoredRequests(stage).filter((request) => request.rumor !== undefined);
  if (requests.length === 0) return null;
  return (
    <section className="rumor-list" aria-labelledby="rumor-list-title" data-testid="rumor-list">
      <h3 id="rumor-list-title">気になるうわさ</h3>
      <p className="rumor-list__hint">いずれ届くかもしれない変更です。備えておくと、あとで楽になります</p>
      <ul>
        {requests.map((request) => (
          <li key={request.id} data-testid={`rumor-${request.id}`}>
            {enabled && <small>{request.rumor?.from}から</small>}
            <p>{request.rumor?.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
