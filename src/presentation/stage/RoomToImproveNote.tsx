import { Fragment, useMemo } from 'react';
import { findClass, type Codebase } from '../../domain/codebase/Codebase';
import { findRoomToImprove, type RoomToImprove } from '../../domain/scoring/roomToImprove';
import { sampleAnswerCodebase, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { responsibilityMarks } from '../../domain/stage/responsibilityMarks';
import type { Stage } from '../../domain/stage/Stage';
import { ResponsibilityMark } from '../editor/ResponsibilityMark';
import { useGameStore } from '../store/useGameStore';

type Marks = ReadonlyMap<string, number>;

function Marked({ responsibility, marks, children }: Readonly<{ responsibility: string; marks: Marks; children?: string }>) {
  return <><ResponsibilityMark number={marks.get(responsibility) ?? 0} />{children}</>;
}

function MethodItem({ item, codebase, marks }: Readonly<{ item: Extract<RoomToImprove, { kind: 'mixed-method' }>; codebase: Codebase; marks: Marks }>) {
  const selectMethod = useGameStore((state) => state.selectMethod);
  const name = findClass(codebase, item.classId)?.methods.find((method) => method.id === item.methodId)?.name ?? item.methodId;
  return (
    <>
      <button type="button" onClick={() => selectMethod(item.methodId)}>{name}()</button> の中に、
      {item.responsibilities.map((responsibility, index) => (
        <Fragment key={responsibility}>
          {index > 0 && '・'}
          <Marked responsibility={responsibility} marks={marks}>{`「${item.fragmentLabels[index] ?? responsibility}」`}</Marked>
        </Fragment>
      ))}
      がまだ一緒に入っています。責務ごとにメソッドへ抽出すると、名前で中身が分かります
    </>
  );
}

function ClassItem({ item, codebase, marks }: Readonly<{ item: Extract<RoomToImprove, { kind: 'crowded-class' }>; codebase: Codebase; marks: Marks }>) {
  const focusHint = useGameStore((state) => state.focusHint);
  const name = findClass(codebase, item.classId)?.name ?? item.classId;
  return (
    <>
      <button type="button" onClick={() => focusHint({ fileIds: [], classIds: [item.classId], methodIds: [] })}>{name}</button>
      {' '}は{item.responsibilities.length}種類の責務(
      {item.responsibilities.map((responsibility, index) => (
        <Fragment key={responsibility}>{index > 0 && '・'}<Marked responsibility={responsibility} marks={marks} /></Fragment>
      ))}
      )を受け持っていて、上限ちょうどです。責務ごとにクラスを分けると、1つの変更で読む範囲がさらに狭くなります
    </>
  );
}

/** 100点のあとに出す、まだ責務が混ざっているところのお知らせ。点数は変えない。 */
export function RoomToImproveNote({ stage, codebase }: Readonly<{ stage: Stage; codebase: Codebase }>) {
  const items = useMemo(
    () => (sampleAnswerSteps[stage.id] === undefined ? [] : findRoomToImprove(codebase, sampleAnswerCodebase(stage), stage)),
    [codebase, stage],
  );
  if (items.length === 0) return null;
  const marks = responsibilityMarks(stage.codebase, codebase, stage.changeRequests.map((request) => request.responsibility));
  return (
    <section className="rumor-list" aria-labelledby="room-to-improve-title" data-testid="room-to-improve-note">
      <h3 id="room-to-improve-title">さらに良くできるところ</h3>
      <p>100点です。減点にはなりませんが、まだ分けられるところがあります</p>
      <ul>
        {items.map((item) => (
          <li key={item.kind === 'mixed-method' ? item.methodId : item.classId} data-testid="room-to-improve-item">
            {item.kind === 'mixed-method'
              ? <MethodItem item={item} codebase={codebase} marks={marks} />
              : <ClassItem item={item} codebase={codebase} marks={marks} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
