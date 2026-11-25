
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const client = createClient(
    'https://nxlovetjigddieykrzny.supabase.co',
    'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ'
);

const BUCKET = 'dealer-verification';
const MAX_SIZE = 10485760;

const TYPES = [
    ['formation', 'Certificate of Incorporation / LLC formation document'],
    ['dealer_license', 'Current Georgia dealer license']
];

const root = document.createElement('section');
root.className = 'panel';
root.id = 'dealer-document-panel';
root.hidden = true;

root.innerHTML = `
    <h2>Required verification documents</h2>
    <p>Upload both required PDF documents.
    Maximum file size: 10 MB per document.</p>
    <p>All documents are private. Rejected documents
    may be corrected and resubmitted. Previous
    submissions remain securely preserved.</p>
    <p id="doc-status" role="status" aria-live="polite"></p>
    <button type="button" id="doc-refresh"
    class="secondary">Refresh document status</button>
    <div id="doc-fields"></div>
`;

const anchor = document.getElementById('authenticated');

if (anchor) anchor.append(root);

let request = 0;
let busy = false;

const message = text => {
    root.querySelector('#doc-status').textContent = text;
};

function retryKey(user, dealer, type, existing) {
    return [
        'newgigz-document-retry',
        user.id,
        dealer.id,
        type,
        existing?.id || 'initial'
    ].join(':');
}

function readRetry(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function saveRetry(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function clearRetry(key) {
    localStorage.removeItem(key);
}

function paragraph(text) {
    const element = document.createElement('p');
    element.textContent = text;
    return element;
}

function statusLabel(status) {
    return {
        pending: 'Pending administrator review',
        verified: 'Verified by NEWGIGZ',
        rejected: 'Rejected — correction required'
    }[status] || 'Unknown status';
}

async function validatePDF(file) {
    if (!file) {
        throw new Error('Choose a PDF first.');
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Only PDF files are allowed.');
    }

    if (file.type && file.type !== 'application/pdf') {
        throw new Error('Invalid PDF file type.');
    }

    if (file.size < 5 || file.size > MAX_SIZE) {
        throw new Error('The PDF must not exceed 10 MB.');
    }

    if (file.name.length > 255) {
        throw new Error('PDF filename is too long.');
    }

    const signature = await file.slice(0, 5).text();

    if (signature !== '%PDF-') {
        throw new Error('The selected file is not a valid PDF.');
    }
}

async function registerDocument(dealer, user, type, existing, record) {
    if (existing) {
        const { error } = await client.rpc(
            'resubmit_dealership_document',
            {
                p_document_id: existing.id,
                p_replacement_id: record.replacementId,
                p_original_filename: record.filename
            }
        );

        if (error) throw error;
    } else {
        const { error } = await client
            .from('dealership_documents')
            .insert({
                dealership_id: dealer.id,
                document_type: type,
                storage_path: record.path,
                original_filename: record.filename,
                uploaded_by: user.id
            });

        if (error) throw error;
    }
}

function addField(type, label, documents, dealer, user) {
    const existing = documents.find(d => d.is_current);

    const history = documents
        .filter(d => !d.is_current)
        .sort((a, b) => b.version_number - a.version_number);

    const eligible =
        dealer.status === 'pending' &&
        (!existing || existing.review_status === 'rejected');

    const key = retryKey(user, dealer, type, existing);

    const wrap = document.createElement('section');
    wrap.style.margin = '1.5rem 0';
    wrap.style.padding = '1rem';
    wrap.style.border = '1px solid #777';
    wrap.style.borderRadius = '8px';

    const title = document.createElement('h3');
    title.textContent = label;

    wrap.append(title);

    if (existing) {
        wrap.append(
            paragraph('Version: ' + existing.version_number),
            paragraph('Status: ' + statusLabel(existing.review_status)),
            paragraph('File: ' + existing.original_filename)
        );

        if (existing.review_status === 'rejected') {
            const reason = paragraph(
                'Rejection reason: ' +
                (existing.rejection_reason || 'Contact NEWGIGZ.')
            );

            reason.style.color = '#e57373';
            reason.setAttribute('role', 'note');
            wrap.append(reason);
        }
    } else {
        wrap.append(paragraph('Status: Not uploaded'));
    }

    const inputLabel = document.createElement('label');
    inputLabel.htmlFor = 'doc-' + type;
    inputLabel.textContent = existing
        ? 'Choose corrected PDF'
        : 'Choose PDF';

    const input = document.createElement('input');
    input.id = 'doc-' + type;
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';

    function configureControls() {
        const saved = readRetry(key);

        input.disabled = !eligible || busy || !!saved;
        button.disabled = !eligible || busy;

        button.textContent = saved
            ? 'Retry document registration'
            : existing
                ? 'Upload corrected PDF'
                : 'Upload PDF';
    }

    configureControls();

    button.onclick = async () => {
        if (busy || !eligible) return;

        busy = true;
        configureControls();

        try {
            const { data, error: authError } =
                await client.auth.getUser();

            if (
                authError ||
                !data.user ||
                data.user.id !== user.id
            ) {
                throw new Error('Please sign in again.');
            }

            let record = readRetry(key);

            if (!record) {
                const file = input.files?.[0];

                await validatePDF(file);

                const replacementId = existing
                    ? crypto.randomUUID()
                    : null;

                const path = existing
                    ? `${user.id}/${dealer.id}/${replacementId}/${type}.pdf`
                    : `${user.id}/${dealer.id}/${type}.pdf`;

                record = {
                    replacementId,
                    path,
                    filename: file.name
                };

                message('Uploading PDF securely...');

                const { error: uploadError } =
                    await client.storage
                        .from(BUCKET)
                        .upload(path, file, {
                            contentType: 'application/pdf',
                            upsert: false
                        });

                if (uploadError) throw uploadError;

                saveRetry(key, record);
            }

            message('Registering document submission...');

            try {
                await registerDocument(
                    dealer,
                    user,
                    type,
                    existing,
                    record
                );
            } catch (registrationError) {
                const { data: registered } = await client
                    .from('dealership_documents')
                    .select('id')
                    .eq('dealership_id', dealer.id)
                    .eq('storage_path', record.path)
                    .maybeSingle();

                if (!registered) throw registrationError;
            }

            clearRetry(key);

            message(
                existing
                    ? 'Corrected document submitted successfully. Awaiting review.'
                    : 'Document uploaded successfully. Awaiting review.'
            );

            busy = false;
            await refresh();

        } catch (error) {
            const saved = readRetry(key);

            message(
                saved
                    ? 'PDF uploaded. Registration incomplete. Use Retry document registration. ' + error.message
                    : 'Submission unsuccessful: ' + error.message
            );
        } finally {
            busy = false;
            configureControls();
        }
    };

    wrap.append(inputLabel, input, button);

    if (history.length) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');

        summary.textContent = 'Previous submission history';

        details.append(summary);

        for (const old of history) {
            const item = document.createElement('div');
            item.style.padding = '0.5rem 0';

            item.append(
                paragraph('Version ' + old.version_number),
                paragraph('File: ' + old.original_filename),
                paragraph('Status: ' + statusLabel(old.review_status))
            );

            if (old.rejection_reason) {
                item.append(
                    paragraph('Reason: ' + old.rejection_reason)
                );
            }

            if (old.rejected_at) {
                item.append(
                    paragraph(
                        'Reviewed: ' +
                        new Date(old.rejected_at).toLocaleString()
                    )
                );
            }

            details.append(item);
        }

        wrap.append(details);
    }

    if (!eligible) {
        wrap.append(
            paragraph(
                'Replacement uploads are available only for rejected documents while the dealership application is pending.'
            )
        );
    }

    return wrap;
}

async function refresh() {
    if (busy) return;

    const stamp = ++request;

    const { data: authData, error: authError } =
        await client.auth.getUser();

    if (stamp !== request) return;

    root.querySelector('#doc-fields').replaceChildren();

    if (authError || !authData.user) {
        root.hidden = true;
        return;
    }

    const user = authData.user;

    const { data: dealer, error: dealerError } =
        await client
            .from('dealerships')
            .select('id,status')
            .eq('owner_user_id', user.id)
            .maybeSingle();

    if (stamp !== request) return;

    if (dealerError || !dealer) {
        root.hidden = true;
        return;
    }

    root.hidden = false;

    const { data: docs, error: docsError } =
        await client
            .from('dealership_documents')
            .select(`
                id,
                document_type,
                original_filename,
                review_status,
                version_number,
                is_current,
                uploaded_at,
                verified_at,
                rejected_at,
                rejection_reason
            `)
            .eq('dealership_id', dealer.id)
            .order('version_number', { ascending: false });

    if (stamp !== request) return;

    if (docsError) {
        message('Could not load document status.');
        return;
    }

    const fields = root.querySelector('#doc-fields');

    for (const [type, label] of TYPES) {
        fields.append(
            addField(
                type,
                label,
                (docs || []).filter(
                    d => d.document_type === type
                ),
                dealer,
                user
            )
        );
    }

    if (dealer.status !== 'pending') {
        message(
            'Document uploads are available while your dealership application is pending.'
        );
    }
}

root.querySelector('#doc-refresh').onclick = () => {
    refresh().catch(
        () => message('Unable to refresh document status.')
    );
};

client.auth.onAuthStateChange(() => {
    setTimeout(() => {
        refresh().catch(
            () => message('Unable to load verification documents.')
        );
    }, 0);
});

refresh().catch(
    () => message('Unable to load verification documents.')
);
