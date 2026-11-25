
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const client = createClient(
    'https://nxlovetjigddieykrzny.supabase.co',
    'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ'
);

const BUCKET = 'dealer-verification';

const TYPES = [
    ['formation', 'Business formation document'],
    ['dealer_license', 'Dealership license']
];

const root = document.createElement('section');

root.id = 'document-review-panel';
root.hidden = true;
root.className = 'panel';

root.innerHTML = `
    <h2>Dealer document verification</h2>

    <p>Independently verify both current documents
    before approving a dealership application.</p>

    <p>Rejected and historical documents remain
    securely preserved for auditing purposes.</p>

    <p>
        <a href="https://verify.sos.ga.gov/verification/Search.aspx?facility=Y"
           target="_blank"
           rel="noopener noreferrer">
            Georgia dealer license lookup (official)
        </a>
    </p>

    <p>
        <a href="https://ecorp.sos.ga.gov/BusinessSearch"
           target="_blank"
           rel="noopener noreferrer">
            Georgia business registration lookup (official)
        </a>
    </p>

    <button id="doc-review-refresh" type="button">
        Refresh document reviews
    </button>

    <p id="doc-review-notice"
       role="status"
       aria-live="polite"></p>

    <div id="doc-review-list"></div>
`;

const dashboard = document.getElementById('dashboard');

if (dashboard) dashboard.append(root);

let request = 0;
let busy = false;

const msg = value => {
    root.querySelector('#doc-review-notice').textContent = value;
};

function txt(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

function statusLabel(status) {
    return {
        pending: 'Pending review',
        verified: 'Verified',
        rejected: 'Rejected'
    }[status] || 'Unknown status';
}

function formatDate(value) {
    return value
        ? new Date(value).toLocaleString()
        : 'Not recorded';
}

async function requireAdmin() {
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
        throw new Error('Administrator sign-in required.');
    }

    const { data: allowed, error: roleError } =
        await client.rpc('is_auto_club_admin');

    if (roleError || allowed !== true) {
        throw new Error('Administrator access required.');
    }

    return data.user;
}

function privatePDFButton(doc) {
    const button = txt('button', 'Open private PDF');

    button.type = 'button';
    button.className = 'secondary';

    button.onclick = async () => {
        button.disabled = true;

        try {
            await requireAdmin();

            const { data, error } = await client.storage
                .from(BUCKET)
                .createSignedUrl(doc.storage_path, 60);

            if (error || !data?.signedUrl) {
                throw new Error(
                    error?.message || 'Unable to create private PDF link.'
                );
            }

            const link = document.createElement('a');

            link.href = data.signedUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            document.body.append(link);
            link.click();
            link.remove();

        } catch (error) {
            msg('Unable to open PDF: ' + error.message);
        } finally {
            button.disabled = false;
        }
    };

    return button;
}

function documentDetails(doc) {
    const section = document.createElement('div');

    section.append(
        txt('p', 'Version: ' + doc.version_number),
        txt('p', 'Status: ' + statusLabel(doc.review_status)),
        txt('p', 'File: ' + doc.original_filename),
        txt('p', 'Uploaded: ' + formatDate(doc.uploaded_at)),
        privatePDFButton(doc)
    );

    if (doc.review_status === 'verified') {
        section.append(
            txt('p', 'Verified: ' + formatDate(doc.verified_at)),
            txt('p', 'Verified by: ' + (doc.verified_by || 'Not recorded')),
            txt('p', 'Verification notes: ' +
                (doc.verification_notes || 'Not recorded'))
        );
    }

    if (doc.review_status === 'rejected') {
        section.append(
            txt('p', 'Rejected: ' + formatDate(doc.rejected_at)),
            txt('p', 'Rejected by: ' + (doc.rejected_by || 'Not recorded')),
            txt('p', 'Rejection reason: ' +
                (doc.rejection_reason || 'Not recorded'))
        );
    }

    return section;
}

function reviewControls(doc, dealer, label) {
    const section = document.createElement('div');

    const notesLabel = txt(
        'label',
        'Verification notes or rejection reason (minimum 15 characters)'
    );

    const notes = document.createElement('textarea');

    notes.maxLength = 2000;
    notes.required = true;
    notes.rows = 4;

    notesLabel.append(notes);

    const confirmLabel = txt(
        'label',
        ' I independently verified this document against appropriate official records.'
    );

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    confirmLabel.prepend(checkbox);

    const verify = txt('button', 'Mark document verified');
    const reject = txt('button', 'Reject document');

    verify.type = 'button';
    reject.type = 'button';

    reject.className = 'secondary';

    function setDisabled(value) {
        verify.disabled = value;
        reject.disabled = value;
        notes.disabled = value;
        checkbox.disabled = value;
    }

    async function review(action) {
        if (busy) return;

        const reason = notes.value.trim();

        if (reason.length < 15) {
            return msg(
                'Enter meaningful notes of at least 15 characters.'
            );
        }

        if (action === 'verify' && !checkbox.checked) {
            return msg(
                'Confirm independent verification before continuing.'
            );
        }

        if (!confirm(
            `${action === 'verify' ? 'Verify' : 'Reject'} ${label} ` +
            `Version ${doc.version_number} for ${dealer.legal_name}?`
        )) return;

        busy = true;
        setDisabled(true);

        try {
            const user = await requireAdmin();

            if (action === 'verify') {
                const { data, error } = await client
                    .from('dealership_documents')
                    .update({
                        verified_by: user.id,
                        verified_at: new Date().toISOString(),
                        verification_notes: reason
                    })
                    .eq('id', doc.id)
                    .eq('is_current', true)
                    .eq('review_status', 'pending')
                    .select('id,review_status,is_current')
                    .single();

                if (error) throw error;

                if (
                    !data ||
                    data.review_status !== 'verified' ||
                    data.is_current !== true
                ) {
                    throw new Error(
                        'Verification could not be confirmed.'
                    );
                }

                msg(
                    'Document verification recorded successfully.'
                );

            } else {
                const { error } = await client.rpc(
                    'reject_dealership_document',
                    {
                        p_document_id: doc.id,
                        p_reason: reason
                    }
                );

                if (error) throw error;

                const { data, error: checkError } =
                    await client
                        .from('dealership_documents')
                        .select('id,review_status,rejection_reason')
                        .eq('id', doc.id)
                        .single();

                if (
                    checkError ||
                    data?.review_status !== 'rejected' ||
                    data?.rejection_reason !== reason
                ) {
                    throw new Error(
                        'Rejection could not be independently confirmed. Refresh before retrying.'
                    );
                }

                msg(
                    'Document rejected. The dealership can submit a corrected PDF while its application is pending.'
                );
            }

            busy = false;
            await refresh();

        } catch (error) {
            msg('Document review error: ' + error.message);
        } finally {
            busy = false;
            setDisabled(false);
        }
    }

    verify.onclick = () => review('verify');
    reject.onclick = () => review('reject');

    section.append(
        notesLabel,
        confirmLabel,
        verify,
        reject
    );

    return section;
}

function renderDocumentType(dealer, type, label, docs) {
    const section = document.createElement('section');

    section.style.margin = '1rem 0';
    section.style.padding = '1rem';
    section.style.border = '1px solid #777';
    section.style.borderRadius = '8px';

    section.append(txt('h4', label));

    const matching = docs.filter(
        doc => doc.document_type === type
    );

    const current = matching.find(doc => doc.is_current);

    const history = matching
        .filter(doc => !doc.is_current)
        .sort((a, b) => b.version_number - a.version_number);

    if (!current) {
        section.append(txt('p', 'Missing current document.'));
    } else {
        section.append(
            txt('h5', 'Current submission'),
            documentDetails(current)
        );

        if (
            current.review_status === 'pending' &&
            dealer.status === 'pending'
        ) {
            section.append(
                reviewControls(current, dealer, label)
            );
        } else if (current.review_status === 'rejected') {
            section.append(
                txt('p', 'Awaiting corrected document submission.')
            );
        } else {
            section.append(
                txt('p', 'Document review controls unavailable.')
            );
        }
    }

    if (history.length) {
        const details = document.createElement('details');

        details.append(
            txt(
                'summary',
                `Previous submission history (${history.length})`
            )
        );

        for (const old of history) {
            const archived = document.createElement('div');

            archived.style.margin = '1rem 0';

            archived.append(
                txt('h5', 'Archived version ' + old.version_number),
                documentDetails(old),
                txt('p', 'Historical record — read-only.')
            );

            details.append(archived);
        }

        section.append(details);
    }

    return section;
}

async function refresh() {
    if (busy) return;

    const stamp = ++request;
    const list = root.querySelector('#doc-review-list');

    root.hidden = true;
    list.replaceChildren();

    try {
        await requireAdmin();
    } catch {
        return;
    }

    if (stamp !== request) return;

    root.hidden = false;

    const { data: dealers, error } = await client
        .from('dealerships')
        .select('id,legal_name,status,dealer_license_number')
        .order('created_at', { ascending: false })
        .limit(100);

    if (stamp !== request) return;

    if (error) {
        return msg('Could not load dealerships: ' + error.message);
    }

    for (const dealer of dealers || []) {
        if (stamp !== request) return;

        const card = document.createElement('article');

        card.className = 'application';

        card.append(
            txt('h3', `${dealer.legal_name} (${dealer.status})`),
            txt(
                'p',
                'License number: ' +
                (dealer.dealer_license_number || 'Not supplied')
            )
        );

        const { data: docs, error: docError } =
            await client
                .from('dealership_documents')
                .select(`
                    id,
                    document_type,
                    storage_path,
                    original_filename,
                    uploaded_at,
                    verified_at,
                    verified_by,
                    verification_notes,
                    review_status,
                    version_number,
                    is_current,
                    rejected_at,
                    rejected_by,
                    rejection_reason,
                    supersedes_document_id
                `)
                .eq('dealership_id', dealer.id)
                .order('version_number', { ascending: false });

        if (stamp !== request) return;

        if (docError) {
            card.append(
                txt('p', 'Unable to load documents.')
            );

            list.append(card);
            continue;
        }

        const currentDocs = (docs || []).filter(
            doc => doc.is_current
        );

        const ready = TYPES.every(([type]) =>
            currentDocs.some(doc =>
                doc.document_type === type &&
                doc.review_status === 'verified' &&
                doc.verified_at &&
                doc.verified_by
            )
        );

        card.append(
            txt(
                'p',
                ready
                    ? 'Document verification requirements satisfied. Complete the dealership approval review separately.'
                    : 'Document verification incomplete. Dealership approval is blocked.'
            )
        );

        for (const [type, label] of TYPES) {
            card.append(
                renderDocumentType(
                    dealer,
                    type,
                    label,
                    docs || []
                )
            );
        }

        list.append(card);
    }

    if (!dealers?.length) {
        list.append(txt('p', 'No dealerships found.'));
    }
}

root.querySelector('#doc-review-refresh')
    .addEventListener('click', () => {
        refresh().catch(
            () => msg('Unable to refresh document reviews.')
        );
    });

client.auth.onAuthStateChange(() => {
    setTimeout(() => {
        refresh().catch(
            () => msg('Unable to load document reviews.')
        );
    }, 0);
});

refresh().catch(
    () => msg('Unable to load document reviews.')
);
