import type { DictationResult, VocabularyWord } from "@dictation/domain";
import { Button, Icon, IconButton } from "@dictation/ui";

export function PreviousResult({ result }: { result: { result: string; word: string; correctAnswer: string; meaning: string } }) {
  const isCorrect = result.result === "correct";
  return (
    <div className="previous-result">
      <span className={`previous-result-mark ${isCorrect ? "is-correct" : "is-wrong"}`}>{isCorrect ? "✓" : "!"}</span>
      <div>
        <p>
          上一题 · {isCorrect ? "正确" : "错误"}
        </p>
        <strong>{result.correctAnswer || result.word}</strong>
        <span> · {result.meaning}</span>
      </div>
    </div>
  );
}

export function DictationResultTable({
  results,
  words,
  onFavorite,
  onWrongBook,
}: {
  results: DictationResult[];
  words: VocabularyWord[];
  onFavorite: (wordId: number) => void;
  onWrongBook: (word: VocabularyWord) => void;
}) {
  const wordsById = new Map(words.map((word) => [word.id, word]));
  return (
    <div className="dictation-result-table">
      <div className="dictation-result-row dictation-result-header">
        <span>正确答案</span>
        <span>用户答案</span>
        <span>释义</span>
        <span>收藏</span>
        <span>错题本</span>
      </div>
      {results.map((result) => {
        const word = wordsById.get(result.wordId);
        const status = result.result === "correct" ? "correct" : result.result === "wrong" || result.result === "skipped" ? "wrong" : "empty";
        return (
          <div key={result.id} className="dictation-result-row">
            <span className={`result-answer ${status}`}>
              <i />
              <strong>{result.correctAnswer || result.word}</strong>
            </span>
            <span>{result.userAnswer ? `${result.userAnswer}${result.result === "correct" ? " ✓" : ""}` : "空白"}</span>
            <span>{word?.partOfSpeech ? `${word.partOfSpeech} ${result.meaning}` : result.meaning}</span>
            <IconButton icon="star" size="sm" label={word?.isFavorite ? "取消收藏" : "收藏"} active={Boolean(word?.isFavorite)} onClick={() => onFavorite(result.wordId)} />
            <Button variant={word?.inWrongBook ? "danger" : "secondary"} size="sm" disabled={!word} onClick={() => word && onWrongBook(word)}>
              {word?.inWrongBook ? "移出" : "加入"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function PaperGradingTable({
  results,
  words,
  onFavorite,
  onWrongBook,
  onMark,
}: {
  results: DictationResult[];
  words: VocabularyWord[];
  onFavorite: (wordId: number) => void;
  onWrongBook: (word: VocabularyWord) => void;
  onMark: (resultId: number, result: "correct" | "wrong") => void;
}) {
  const wordsById = new Map(words.map((word) => [word.id, word]));
  return (
    <div className="paper-grading-table">
      <div className="paper-grading-row paper-grading-header">
        <span>#</span>
        <span>收藏</span>
        <span>单词</span>
        <span>释义</span>
        <span>批改</span>
        <span>错题本</span>
      </div>
      <div className="paper-grading-body">
        {results.map((result, index) => {
          const word = wordsById.get(result.wordId);
          const isCorrect = result.result === "correct";
          const isWrong = result.result === "wrong" || result.result === "skipped";
          return (
            <div key={result.id} className="paper-grading-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <IconButton icon="star" size="sm" label={word?.isFavorite ? "取消收藏" : "收藏"} active={Boolean(word?.isFavorite)} onClick={() => onFavorite(result.wordId)} />
              <span className={isCorrect ? "paper-word-correct" : result.result === "wrong" ? "paper-word-wrong" : ""}>
                <strong>{result.correctAnswer || result.word}</strong>
                {word?.phonetic ? <small>{word.phonetic}</small> : null}
              </span>
              <span>{word?.partOfSpeech ? `${word.partOfSpeech} ${result.meaning}` : result.meaning}</span>
              <span className="paper-grading-actions">
                <Button variant={isCorrect ? "primary" : "secondary"} size="sm" iconStart={<Icon name="check" size={14} />} onClick={() => onMark(result.id, "correct")}>正确</Button>
                <Button variant={!isCorrect && isWrong ? "danger" : "secondary"} size="sm" iconStart={<Icon name="x" size={14} />} onClick={() => onMark(result.id, "wrong")}>错误</Button>
              </span>
              <Button variant={word?.inWrongBook ? "danger" : "secondary"} size="sm" disabled={!word} onClick={() => word && onWrongBook(word)}>
                {word?.inWrongBook ? "移出" : "加入"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
