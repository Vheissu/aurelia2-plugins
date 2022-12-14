export default `<template>
<template replaceable part="pagination">
    <nav hide.bind="hideSinglePage && totalPages === 1">
        <ul class="pagination">

            <li class="page-item \${currentPage === 1 ? 'disabled' : ''}" if.bind="boundaryLinks">
                <a class="page-link" aria-label="Previous" click.delegate="firstPage()">
                    <span aria-hidden="true" innerhtml.bind="firstText"></span>
                </a>
            </li>

            <li class="page-item \${currentPage === 1 ? 'disabled' : ''}" if.bind="directionLinks">
                <a class="page-link" aria-label="Previous" click.delegate="previousPage()">
                    <span aria-hidden="true" innerhtml.bind="previousText"></span>
                </a>
            </li>

            <li repeat.for="page of displayPages" class="page-item \${currentPage === page.value ? 'active' : ''}">
                <a class="page-link" click.delegate="selectPage(page.value)">\${page.title}</a>
            </li>

            <li class="page-item \${currentPage === totalPages ? 'disabled' : ''}" if.bind="directionLinks">
                <a class="page-link" aria-label="Next" click.delegate="nextPage()">
                    <span aria-hidden="true" innerhtml.bind="nextText"></span>
                </a>
            </li>

            <li class="page-item \${currentPage === totalPages ? 'disabled' : ''}" if.bind="boundaryLinks">
                <a class="page-link" aria-label="Previous" click.delegate="lastPage()">
                    <span aria-hidden="true" innerhtml.bind="lastText"></span>
                </a>
            </li>
        </ul>
    </nav>
</template>
</template>`;