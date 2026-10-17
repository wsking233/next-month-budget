import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { pages } from './pages/config';

describe('应用骨架', () => {
  it.each(pages)('$title 路由可直接访问', (page) => {
    render(<MemoryRouter initialEntries={[page.path]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: page.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: page.title })).toHaveAttribute('aria-current', 'page');
  });

  it('通过导航切换页面，并支持未知地址返回概览', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/unknown']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '这页暂时找不到' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '返回概览' }));
    await user.click(screen.getByRole('link', { name: '账单' }));
    expect(screen.getByRole('heading', { level: 1, name: '账单' })).toBeInTheDocument();
  });

  it('可切换深浅主题', async () => {
    document.documentElement.classList.remove('dark');
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    await user.click(screen.getAllByRole('button', { name: '切换深色主题' })[0]);
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getAllByRole('button', { name: '切换浅色主题' })[0]);
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
