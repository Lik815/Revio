'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiBaseCandidates } from './api-base';

export type LoginState = {
  error: string | null;
};

async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('revio_admin_token')?.value ?? '';
}

async function adminRequest(path: string, init?: { method?: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) {
  const token = await getAdminToken();
  let lastError: unknown;

  for (const base of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: init?.method ?? 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
      if (!res.ok) {
        // Die menschenlesbare Fehlermeldung der API durchreichen (z. B.
        // "Diese E-Mail-Adresse ist bereits vergeben."), statt nur den Status.
        // 4xx sind fachliche Fehler → nicht auf den nächsten Base-Kandidaten
        // ausweichen, sondern sofort weiterreichen.
        let message = `API ${res.status}: ${path}`;
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch {}
        throw new Error(message);
      }
      // Antwort-Body zurückgeben (z. B. für die ID eines neu angelegten
      // Datensatzes). Rückwärtskompatibel — Aufrufer, die nichts brauchen,
      // ignorieren den Rückgabewert. Kein/leerer Body → null.
      try {
        return await res.json();
      } catch {
        return null;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(`API nicht erreichbar: ${path}`);
}

// Profilfoto als Multipart an die API weiterreichen (adminRequest sendet nur
// JSON). Gibt eine Fehlermeldung zurück oder null bei Erfolg.
async function forwardTherapistPhoto(id: string, file: File): Promise<string | null> {
  const token = await getAdminToken();
  const forward = new FormData();
  forward.append('photo', file);
  for (const base of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}/admin/therapists/${id}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: forward,
      });
      if (!res.ok) {
        let message = `API ${res.status}`;
        try { const b = await res.json(); if (b?.message) message = b.message; } catch {}
        return message;
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Upload fehlgeschlagen.';
    }
  }
  return 'API nicht erreichbar.';
}

export async function loginAdmin(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  let res: Response | null = null;

  for (const base of getApiBaseCandidates()) {
    try {
      res = await fetch(`${base}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
      });
      break;
    } catch {
      continue;
    }
  }

  if (!res) {
    return { error: 'Die Admin-API ist aktuell nicht erreichbar. Bitte pruefe, ob sie lokal laeuft.' };
  }

  if (!res.ok) {
    return { error: 'E-Mail oder Passwort ist falsch.' };
  }

  const data = await res.json();
  const cookieStore = await cookies();
  cookieStore.set('revio_admin_token', data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });
  cookieStore.set('revio_admin_user', JSON.stringify(data.admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });

  redirect('/');
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('revio_admin_token');
  cookieStore.delete('revio_admin_user');
  redirect('/login');
}

// Therapist actions

// Directory-First-Refactor (R1): Operator legt ein Therapeuten-Profil an —
// nur mit dokumentierter Zustimmung. Fehler (z. B. 409 "E-Mail bereits
// vergeben") werden abgefangen und als Meldung zur Seite zurückgegeben, statt
// die Server-Component-Render mit einem ungefangenen Throw abstürzen zu lassen.
export async function createTherapist(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  // Therapist.fullName ist ein einzelnes Feld — aus Vor- und Nachname
  // zusammengesetzt, wie bei der Selbstregistrierung (register.ts).
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const city = String(formData.get('city') ?? '').trim();
  const consentChannel = String(formData.get('consentChannel') ?? '').trim();
  if (!email || !firstName || !lastName || !city || !consentChannel) {
    redirect('/therapists/neu?formError=' + encodeURIComponent('Bitte E-Mail, Vorname, Nachname, Stadt und Zustimmungs-Kanal ausfüllen.'));
  }

  // Mehrfach-Checkboxen liefern mehrere Werte unter demselben Namen → getAll.
  const list = (key: string) => formData.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  const str = (key: string) => String(formData.get(key) ?? '').trim() || undefined;
  const radiusRaw = str('serviceRadiusKm');
  const serviceRadiusKm = radiusRaw ? Number(radiusRaw) : undefined;
  const gender = str('gender');

  let errorMessage: string | null = null;
  let createdId: string | null = null;
  try {
    const created = await adminRequest('/admin/therapists/create', {
      body: {
        email,
        fullName,
        city,
        consentChannel,
        consentNote: str('consentNote'),
        professionalTitle: str('professionalTitle'),
        gender: gender === 'female' || gender === 'male' ? gender : undefined,
        bio: str('bio'),
        phone: str('phone'),
        postalCode: str('postalCode'),
        street: str('street'),
        houseNumber: str('houseNumber'),
        homeVisit: formData.get('homeVisit') === 'true',
        serviceRadiusKm: serviceRadiusKm && !Number.isNaN(serviceRadiusKm) ? serviceRadiusKm : undefined,
        specializations: list('specializations'),
        languages: list('languages'),
        certifications: list('certifications'),
        heilmittel: list('heilmittel'),
        kassenarten: list('kassenarten'),
      },
    });
    createdId = created?.id ?? null;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Anlegen fehlgeschlagen.';
  }

  // redirect() wirft intern NEXT_REDIRECT — deshalb außerhalb des try/catch.
  if (errorMessage) {
    redirect('/therapists/neu?formError=' + encodeURIComponent(errorMessage));
  }

  // Optionales Profilfoto direkt mit anlegen: Der Therapeut ist schon erstellt,
  // das Foto wird als zweiter Schritt hochgeladen. Schlägt das fehl, bleibt der
  // Therapeut bestehen — wir leiten dann zur Detailseite, wo das Foto erneut
  // hochgeladen werden kann, statt das ganze Anlegen zu verwerfen.
  const photo = formData.get('photo');
  if (createdId && photo instanceof File && photo.size > 0) {
    const photoError = await forwardTherapistPhoto(createdId, photo);
    if (photoError) {
      revalidatePath('/therapists');
      redirect(`/therapists/${createdId}?photoError=` + encodeURIComponent('Therapeut angelegt, aber Foto-Upload fehlgeschlagen: ' + photoError));
    }
  }

  revalidatePath('/therapists');
  redirect('/therapists?created=' + encodeURIComponent(fullName));
}

// Nur möglich solange der Therapeut unbeansprucht ist (userId null) — die
// API weist den Zugriff sonst mit 403 zurück.
export async function updateTherapist(id: string, formData: FormData) {
  await adminRequest(`/admin/therapists/${id}/update`, {
    body: {
      fullName: String(formData.get('fullName') ?? '').trim() || undefined,
      professionalTitle: String(formData.get('professionalTitle') ?? '').trim() || undefined,
      city: String(formData.get('city') ?? '').trim() || undefined,
      bio: String(formData.get('bio') ?? '').trim() || undefined,
    },
  });

  revalidatePath('/therapists');
  revalidatePath(`/therapists/${id}`);
}

// Profilfoto hochladen (Bearbeiten-Seite).
export async function uploadTherapistPhoto(id: string, formData: FormData) {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/therapists/${id}?photoError=` + encodeURIComponent('Bitte eine Bilddatei auswählen.'));
  }

  const errorMessage = await forwardTherapistPhoto(id, file as File);
  if (errorMessage) {
    redirect(`/therapists/${id}?photoError=` + encodeURIComponent(errorMessage));
  }

  revalidatePath('/therapists');
  revalidatePath(`/therapists/${id}`);
  redirect(`/therapists/${id}?photoOk=1`);
}

// Therapeut archivieren (Soft-Delete, reversibel).
export async function archiveTherapist(id: string) {
  let errorMessage: string | null = null;
  try {
    await adminRequest(`/admin/therapists/${id}/archive`);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Archivieren fehlgeschlagen.';
  }
  if (errorMessage) {
    redirect(`/therapists/${id}?photoError=` + encodeURIComponent(errorMessage));
  }
  revalidatePath('/therapists');
  revalidatePath(`/therapists/${id}`);
  redirect('/therapists?archived=1');
}

// Archivierten Therapeuten wiederherstellen.
export async function unarchiveTherapist(id: string) {
  let errorMessage: string | null = null;
  try {
    await adminRequest(`/admin/therapists/${id}/unarchive`);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Wiederherstellen fehlgeschlagen.';
  }
  if (errorMessage) {
    redirect(`/therapists/${id}?photoError=` + encodeURIComponent(errorMessage));
  }
  revalidatePath('/therapists');
  revalidatePath(`/therapists/${id}`);
  redirect(`/therapists/${id}?restored=1`);
}

// Endgültig löschen — API erlaubt das nur für bereits archivierte Profile.
export async function deleteTherapist(id: string) {
  let errorMessage: string | null = null;
  try {
    await adminRequest(`/admin/therapists/${id}/delete`);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.';
  }
  if (errorMessage) {
    redirect(`/therapists/${id}?photoError=` + encodeURIComponent(errorMessage));
  }
  revalidatePath('/therapists');
  redirect('/therapists?deleted=1&status=ARCHIVED');
}

export async function approveTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/approve`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function rejectTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/reject`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function requestChangesTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/request-changes`);
  revalidatePath('/therapists');
}

export async function suspendTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/suspend`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function setQualifikationStatus(id: string, status: 'UNGEPRÜFT' | 'EINGEREICHT' | 'VERIFIZIERT' | 'ABGELAUFEN') {
  await adminRequest(`/admin/therapists/${id}/qualifikation-status`, { body: { status } });
  revalidatePath(`/therapists/${id}`);
}

export async function approvePractice(id: string) {
  await adminRequest(`/admin/practices/${id}/approve`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function rejectPractice(id: string) {
  await adminRequest(`/admin/practices/${id}/reject`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function suspendPractice(id: string) {
  await adminRequest(`/admin/practices/${id}/suspend`);
  revalidatePath('/practices');
  revalidatePath('/');
}

// Directory-First-Refactor (P2): Operator legt eine Praxis manuell an.
export async function createPractice(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  if (!name || !city) {
    redirect('/practices/neu?formError=' + encodeURIComponent('Bitte Name und Stadt ausfüllen.'));
  }

  const str = (key: string) => String(formData.get(key) ?? '').trim() || undefined;

  let errorMessage: string | null = null;
  try {
    await adminRequest('/admin/practices/create', {
      body: {
        name,
        city,
        address: str('address'),
        street: str('street'),
        houseNumber: str('houseNumber'),
        postalCode: str('postalCode'),
        phone: str('phone'),
        hours: str('hours'),
        description: str('description'),
        homeVisit: formData.get('homeVisit') === 'true',
      },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Anlegen fehlgeschlagen.';
  }

  // redirect() wirft intern NEXT_REDIRECT — deshalb außerhalb des try/catch.
  if (errorMessage) {
    redirect('/practices/neu?formError=' + encodeURIComponent(errorMessage));
  }

  revalidatePath('/practices');
  redirect('/practices?created=' + encodeURIComponent(name));
}

// Nur möglich solange die Praxis unbeansprucht ist (ownerId null) — die API
// weist den Zugriff sonst mit 403 zurück.
export async function updatePractice(id: string, formData: FormData) {
  await adminRequest(`/admin/practices/${id}/update`, {
    body: {
      name: String(formData.get('name') ?? '').trim() || undefined,
      city: String(formData.get('city') ?? '').trim() || undefined,
      address: String(formData.get('address') ?? '').trim() || undefined,
      street: String(formData.get('street') ?? '').trim() || undefined,
      houseNumber: String(formData.get('houseNumber') ?? '').trim() || undefined,
      postalCode: String(formData.get('postalCode') ?? '').trim() || undefined,
      phone: String(formData.get('phone') ?? '').trim() || undefined,
      hours: String(formData.get('hours') ?? '').trim() || undefined,
      description: String(formData.get('description') ?? '').trim() || undefined,
      homeVisit: formData.get('homeVisit') === 'true',
    },
  });

  revalidatePath('/practices');
}

export async function confirmLink(id: string) {
  await adminRequest(`/admin/links/${id}/confirm`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

// Directory-First-Refactor (R2): Admin verknüpft eine bestehende Praxis mit
// einem bestehenden Therapeuten manuell — startet direkt als CONFIRMED.
export async function createLink(formData: FormData) {
  const therapistId = String(formData.get('therapistId') ?? '').trim();
  const practiceId = String(formData.get('practiceId') ?? '').trim();
  if (!therapistId || !practiceId) return;

  await adminRequest('/admin/links', {
    body: { therapistId, practiceId },
  });

  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

export async function rejectLink(id: string) {
  await adminRequest(`/admin/links/${id}/reject`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

export async function disputeLink(id: string) {
  await adminRequest(`/admin/links/${id}/dispute`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

// Certification option actions
export async function createCertificationOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/certifications', {
    body: { label },
  });
  revalidatePath('/settings');
}

export async function updateCertificationOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/certifications/${id}/update`, {
    body: { label },
  });
  revalidatePath('/settings');
}

export async function toggleCertificationOption(id: string) {
  await adminRequest(`/admin/certifications/${id}/toggle`);
  revalidatePath('/settings');
}

export async function deleteCertificationOption(id: string) {
  await adminRequest(`/admin/certifications/${id}/delete`);
  revalidatePath('/settings');
}

// Heilmittel option actions
export async function createHeilmittelOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/heilmittel', {
    body: { label },
  });
  revalidatePath('/heilmittel');
}

export async function updateHeilmittelOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/heilmittel/${id}/update`, {
    body: { label },
  });
  revalidatePath('/heilmittel');
}

export async function toggleHeilmittelOption(id: string) {
  await adminRequest(`/admin/heilmittel/${id}/toggle`);
  revalidatePath('/heilmittel');
}

export async function deleteHeilmittelOption(id: string) {
  await adminRequest(`/admin/heilmittel/${id}/delete`);
  revalidatePath('/heilmittel');
}

// Specialization option actions
export async function createSpecializationOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/specializations', {
    body: { label },
  });
  revalidatePath('/specializations');
}

export async function updateSpecializationOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/specializations/${id}/update`, {
    body: { label },
  });
  revalidatePath('/specializations');
}

export async function toggleSpecializationOption(id: string) {
  await adminRequest(`/admin/specializations/${id}/toggle`);
  revalidatePath('/specializations');
}

export async function deleteSpecializationOption(id: string) {
  await adminRequest(`/admin/specializations/${id}/delete`);
  revalidatePath('/specializations');
}

export async function updateSiteUnderConstruction(formData: FormData) {
  const value = String(formData.get('underConstruction') ?? '').trim();
  const underConstruction = value === 'true';

  await adminRequest('/admin/site-settings/update', {
    body: { underConstruction },
  });

  revalidatePath('/settings');
}

export async function updateAppBookingEnabled(formData: FormData) {
  const value = String(formData.get('appBookingEnabled') ?? '').trim();
  const appBookingEnabled = value === 'true';

  await adminRequest('/admin/site-settings/update', {
    body: { appBookingEnabled },
  });

  revalidatePath('/settings');
}

export async function updateAppFeedbackStatus(id: string, formData: FormData) {
  const status = String(formData.get('status') ?? '').trim();
  if (status !== 'NEW' && status !== 'RESOLVED') return;

  await adminRequest(`/admin/feedback/${id}/status`, {
    body: { status },
  });

  revalidatePath('/feedback');
}

function slugifyBlogTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function createBlogPost(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim();
  const excerpt = String(formData.get('excerpt') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const authorName = String(formData.get('authorName') ?? 'Revio Team').trim() || 'Revio Team';
  const slug = slugInput || slugifyBlogTitle(title);

  if (!slug || !title || !excerpt || !content) return;

  await adminRequest('/admin/blog-posts', {
    body: { slug, title, excerpt, content, authorName },
  });

  revalidatePath('/blog');
}

export async function updateBlogPost(id: string, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim();
  const excerpt = String(formData.get('excerpt') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const authorName = String(formData.get('authorName') ?? 'Revio Team').trim() || 'Revio Team';
  const slug = slugInput || slugifyBlogTitle(title);

  if (!slug || !title || !excerpt || !content) return;

  await adminRequest(`/admin/blog-posts/${id}/update`, {
    body: { slug, title, excerpt, content, authorName },
  });

  revalidatePath('/blog');
}

export async function toggleBlogPostPublish(id: string) {
  await adminRequest(`/admin/blog-posts/${id}/toggle-publish`);
  revalidatePath('/blog');
}

export async function deleteBlogPost(id: string) {
  await adminRequest(`/admin/blog-posts/${id}/delete`);
  revalidatePath('/blog');
}
