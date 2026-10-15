import { Award, BookOpen, Check, Library, ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  listMyReadingAchievements,
  type ReadingAchievement,
} from '../../services/library/achievementService'
import type { LibraryEntry } from '../../services/library/libraryService'

function countForAchievement(
  achievement: ReadingAchievement,
  entries: LibraryEntry[],
) {
  switch (achievement.criteria_type) {
    case 'library_count':
      return entries.length
    case 'reading_count':
      return entries.filter((entry) => entry.reading_status === 'reading').length
    case 'completed_count':
      return entries.filter((entry) => entry.reading_status === 'completed').length
    case 'chapter_count':
      return entries.filter((entry) => Boolean(entry.last_chapter?.trim())).length
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function ReadingDashboard({
  userId,
  entries,
}: {
  userId: string
  entries: LibraryEntry[]
}) {
  const [achievements, setAchievements] = useState<ReadingAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const readingCount = entries.filter((entry) => entry.reading_status === 'reading').length
  const completedCount = entries.filter((entry) => entry.reading_status === 'completed').length
  const chapterCount = entries.filter((entry) => Boolean(entry.last_chapter?.trim())).length
  const completionPercent = entries.length === 0
    ? 0
    : Math.round((completedCount / entries.length) * 100)
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked_at).length

  useEffect(() => {
    let active = true
    listMyReadingAchievements(userId)
      .then((nextAchievements) => {
        if (active) setAchievements(nextAchievements)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los logros.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [userId])

  return (
    <section className="reading-dashboard" aria-labelledby="reading-dashboard-title">
      <div className="reading-dashboard-heading">
        <div>
          <p className="eyebrow">Tu recorrido</p>
          <h2 id="reading-dashboard-title">Progreso y logros</h2>
        </div>
        {!loading && !error && (
          <p className="achievement-total">
            <Award size={18} aria-hidden="true" />
            {unlockedCount} de {achievements.length} logros
          </p>
        )}
      </div>

      <div className="reading-stats">
        <div>
          <Library size={18} aria-hidden="true" />
          <strong>{entries.length}</strong>
          <span>en biblioteca</span>
        </div>
        <div>
          <BookOpen size={18} aria-hidden="true" />
          <strong>{readingCount}</strong>
          <span>en lectura</span>
        </div>
        <div>
          <Check size={18} aria-hidden="true" />
          <strong>{completedCount}</strong>
          <span>terminadas</span>
        </div>
        <div>
          <ScrollText size={18} aria-hidden="true" />
          <strong>{chapterCount}</strong>
          <span>con capítulo registrado</span>
        </div>
      </div>

      <div className="reading-completion">
        <div>
          <span>Obras terminadas de tu biblioteca</span>
          <strong>{completionPercent}%</strong>
        </div>
        <progress
          value={completedCount}
          max={Math.max(entries.length, 1)}
          aria-label={`${completionPercent}% de obras terminadas`}
        />
      </div>

      <div className="achievement-section">
        <h3>Tus logros</h3>
        {loading && <p role="status">Cargando logros…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!loading && !error && (
          <ul className="achievement-list">
            {achievements.map((achievement) => {
              const earned = achievement.unlocked_at !== null
              const progress = Math.min(countForAchievement(achievement, entries), achievement.threshold)
              return (
                <li
                  className={`achievement-card${earned ? ' is-unlocked' : ''}`}
                  key={achievement.id}
                >
                  <span className="achievement-icon" aria-hidden="true">
                    {earned ? <Check size={20} /> : <Award size={20} />}
                  </span>
                  <div className="achievement-copy">
                    <div className="achievement-title">
                      <h4>{achievement.title}</h4>
                      {earned && <span>Desbloqueado</span>}
                    </div>
                    <p>{achievement.description}</p>
                    {earned ? (
                      <time dateTime={achievement.unlocked_at ?? undefined}>
                        Desbloqueado el {formatDate(achievement.unlocked_at ?? '')}
                      </time>
                    ) : (
                      <div className="achievement-progress">
                        <progress
                          value={progress}
                          max={achievement.threshold}
                          aria-label={`Progreso de ${achievement.title}: ${progress} de ${achievement.threshold}`}
                        />
                        <span>{progress}/{achievement.threshold}</span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="form-hint">Tu progreso y tus logros son privados y solo tú puedes verlos.</p>
    </section>
  )
}
