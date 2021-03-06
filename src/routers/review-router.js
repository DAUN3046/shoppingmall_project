import { Router } from 'express';
import is from '@sindresorhus/is';
// 폴더에서 import하면, 자동으로 폴더의 index.js에서 가져옴
import { loginRequired, isAdmin } from '../middlewares';
import {
	reviewService,
	productService,
	orderedProductService,
	orderService,
} from '../services';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

const reviewRouter = Router();

// 작성자 1명이 쓴 리뷰들 가져오기
reviewRouter.get('/reviewsByAuthor', loginRequired, async (req, res, next) => {
	try {
		// loginRequired에서 토큰에 있는 userId를 받아왔음.
		// user는 objectId 임
		const userId = req.currentUserId;

		const reviews = await reviewService.getReviewsByauthor(userId);
		res.status(200).json(reviews);
	} catch (error) {
		next(error);
	}
});

// 리뷰등록
reviewRouter.post('/reviews', loginRequired, async (req, res, next) => {
	try {
		// Content-Type: application/json 설정을 안 한 경우, 에러를 만들도록 함.
		// application/json 설정을 프론트에서 안 하면, body가 비어 있게 됨.
		if (is.emptyObject(req.body)) {
			throw new Error(
				'headers의 Content-Type을 application/json으로 설정해주세요',
			);
		}

		// loginRequired에서 토큰에 있는 userId를 받아왔음.
		// user는 objectId 임
		const userId = req.currentUserId;
		const { comment, starRate, productId } = req.body;

		const product = await productService.getProductById(productId);
		const productObjectId = product._id;
		// 해당 제품을 주문했던 주문 기록 여러 개 (배열)
		const orderedProducts = await orderedProductService.findByProductId(
			productObjectId,
		);
		let people = [];
		for (let i = 0; i < orderedProducts.length; i++) {
			const orderId = orderedProducts[i].orderId;
			const order = await orderService.getOrder(orderId);
			console.log(order);
			// order.buyer가 user objectId 임
			if (order) {
				people.push(order.buyer);
			}
		}
		for (let i = 0; i < people.length; i++) {
			people[i] = people[i].toString();
		}
		if (people.indexOf(userId) >= 0) {
			// 위 데이터를 review db에 추가하기
			const newReview = await reviewService.addReview({
				comment,
				starRate,
				author: userId,
			});

			// product schema에 reivew 추가
			const newReviewId = newReview._id;
			const product = await productService.getProductById(productId);
			let reviews = product.review;
			reviews.push(newReviewId);
			await productService.setProduct(productId, {
				review: reviews,
				starRateSum: product.starRateSum + starRate,
				reviewCount: product.reviewCount + 1,
			});

			// 추가된 상품의 db 데이터를 프론트에 다시 보내줌
			// 물론 프론트에서 안 쓸 수도 있지만, 편의상 일단 보내 줌
			res.status(201).json(newReview);
		} else {
			throw new Error('제품을 구매한 사용자만 리뷰를 등록할 수 있습니다.');
		}
	} catch (error) {
		next(error);
	}
});

// 리뷰 수정
reviewRouter.patch('/reviews', loginRequired, async function (req, res, next) {
	try {
		// content-type 을 application/json 로 프론트에서
		// 설정 안 하고 요청하면, body가 비어 있게 됨.
		if (is.emptyObject(req.body)) {
			throw new Error(
				'headers의 Content-Type을 application/json으로 설정해주세요',
			);
		}

		// front에서 이렇게 줄 것이라 예상
		const reviewId = req.query.reviewId;

		const { comment, starRate } = req.body;

		const toUpdate = {
			...(comment && { comment }),
			...(starRate ** { starRate }),
		};
		const updatedReview = await reviewService.setReview(reviewId, toUpdate);

		res.status(200).json(updatedReview);
	} catch (error) {
		next(error);
	}
});

// 리뷰 삭제
reviewRouter.delete('/reviews', loginRequired, async function (req, res, next) {
	try {
		// content-type 을 application/json 로 프론트에서
		// 설정 안 하고 요청하면, body가 비어 있게 됨.
		if (is.emptyObject(req.headers)) {
			throw new Error(
				'headers의 Content-Type을 application/json으로 설정해주세요',
			);
		}

		// front에서 이렇게 줄 것이라 예상
		const reviewId = req.query.reviewId;

		await reviewService.deleteReviewByReviewId(reviewId);
		res.status(200).json({ status: 'ok' });
	} catch (error) {
		next(error);
	}
});

export { reviewRouter };
